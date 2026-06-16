import { openDB, type IDBPDatabase } from "idb";
import {
  b64,
  decryptJSON,
  deriveKey,
  encryptJSON,
  randomSalt,
  unb64,
  uid,
} from "./crypto";

export interface MeetingProtocol {
  title: string;
  participants: string[];
  summary: string;
  decisions_by_speaker: Record<string, string[]>;
  action_items: { task: string; owner: string; due: string }[];
}

export interface MeetingContent {
  transcript: string;
  protocol: MeetingProtocol | null;
  notes: string;
}

export interface Meeting {
  id: string;
  folderId: string | null;
  title: string;
  createdAt: number;
  updatedAt: number;
  // encrypted content
  iv: string;
  ct: string;
}

export interface Folder {
  id: string;
  name: string;
  createdAt: number;
}

interface MetaRow {
  key: string;
  value: unknown;
}

const DB_NAME = "vaultrecord";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase> | null = null;
export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        db.createObjectStore("meta", { keyPath: "key" });
        const m = db.createObjectStore("meetings", { keyPath: "id" });
        m.createIndex("folderId", "folderId");
        m.createIndex("updatedAt", "updatedAt");
        db.createObjectStore("folders", { keyPath: "id" });
      },
    });
  }
  return dbPromise;
}

async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDB();
  const row = (await db.get("meta", key)) as MetaRow | undefined;
  return row?.value as T | undefined;
}
async function setMeta(key: string, value: unknown) {
  const db = await getDB();
  await db.put("meta", { key, value });
}

// --- Master password lifecycle ---

const VERIFIER_PT = "VAULTRECORD_OK_v1";

export async function isInitialized(): Promise<boolean> {
  return Boolean(await getMeta<string>("salt"));
}

export async function initializeMaster(password: string): Promise<CryptoKey> {
  const salt = randomSalt();
  const key = await deriveKey(password, salt);
  const verifier = await encryptJSON(key, VERIFIER_PT);
  await setMeta("salt", b64(salt));
  await setMeta("verifier", verifier);
  return key;
}

export async function unlockMaster(password: string): Promise<CryptoKey | null> {
  const saltB64 = await getMeta<string>("salt");
  const verifier = await getMeta<{ iv: string; ct: string }>("verifier");
  if (!saltB64 || !verifier) return null;
  const key = await deriveKey(password, unb64(saltB64));
  try {
    const v = await decryptJSON<string>(key, verifier);
    if (v !== VERIFIER_PT) return null;
    return key;
  } catch {
    return null;
  }
}

// --- Settings (encrypted) ---

export interface Settings {
  geminiApiKey: string;
  language: "en" | "he";
}

const DEFAULT_SETTINGS: Settings = { geminiApiKey: "", language: "en" };

export async function loadSettings(key: CryptoKey): Promise<Settings> {
  const enc = await getMeta<{ iv: string; ct: string }>("settings");
  if (!enc) return DEFAULT_SETTINGS;
  try {
    return await decryptJSON<Settings>(key, enc);
  } catch {
    return DEFAULT_SETTINGS;
  }
}
export async function saveSettings(key: CryptoKey, settings: Settings) {
  await setMeta("settings", await encryptJSON(key, settings));
}

// --- Folders ---

export async function listFolders(): Promise<Folder[]> {
  const db = await getDB();
  return (await db.getAll("folders")) as Folder[];
}
export async function createFolder(name: string): Promise<Folder> {
  const db = await getDB();
  const f: Folder = { id: uid(), name, createdAt: Date.now() };
  await db.put("folders", f);
  return f;
}
export async function deleteFolder(id: string) {
  const db = await getDB();
  await db.delete("folders", id);
  // unassign meetings
  const all = (await db.getAll("meetings")) as Meeting[];
  const tx = db.transaction("meetings", "readwrite");
  for (const m of all) {
    if (m.folderId === id) {
      m.folderId = null;
      await tx.store.put(m);
    }
  }
  await tx.done;
}

// --- Meetings ---

export async function listMeetings(): Promise<Meeting[]> {
  const db = await getDB();
  const all = (await db.getAll("meetings")) as Meeting[];
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function loadMeetingContent(
  key: CryptoKey,
  m: Meeting,
): Promise<MeetingContent> {
  try {
    return await decryptJSON<MeetingContent>(key, { iv: m.iv, ct: m.ct });
  } catch {
    return { transcript: "", protocol: null, notes: "" };
  }
}

export async function saveMeeting(
  key: CryptoKey,
  opts: {
    id?: string;
    folderId: string | null;
    title: string;
    content: MeetingContent;
  },
): Promise<Meeting> {
  const db = await getDB();
  const now = Date.now();
  const enc = await encryptJSON(key, opts.content);
  const id = opts.id ?? uid();
  const existing = opts.id ? ((await db.get("meetings", opts.id)) as Meeting | undefined) : undefined;
  const m: Meeting = {
    id,
    folderId: opts.folderId,
    title: opts.title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    iv: enc.iv,
    ct: enc.ct,
  };
  await db.put("meetings", m);
  return m;
}

export async function deleteMeeting(id: string) {
  const db = await getDB();
  await db.delete("meetings", id);
}

// --- Backup (already encrypted with master key) ---

export interface Backup {
  app: "VaultRecord";
  version: 1;
  exportedAt: number;
  salt: string;
  verifier: { iv: string; ct: string };
  settings: { iv: string; ct: string } | null;
  folders: Folder[];
  meetings: Meeting[];
}

export async function exportBackup(): Promise<Backup> {
  const db = await getDB();
  const salt = (await getMeta<string>("salt")) ?? "";
  const verifier = (await getMeta<{ iv: string; ct: string }>("verifier")) ?? {
    iv: "",
    ct: "",
  };
  const settings = (await getMeta<{ iv: string; ct: string }>("settings")) ?? null;
  const folders = (await db.getAll("folders")) as Folder[];
  const meetings = (await db.getAll("meetings")) as Meeting[];
  return {
    app: "VaultRecord",
    version: 1,
    exportedAt: Date.now(),
    salt,
    verifier,
    settings,
    folders,
    meetings,
  };
}

export async function importBackup(b: Backup) {
  if (b.app !== "VaultRecord") throw new Error("Invalid backup file");
  const db = await getDB();
  await setMeta("salt", b.salt);
  await setMeta("verifier", b.verifier);
  if (b.settings) await setMeta("settings", b.settings);
  const tx = db.transaction(["folders", "meetings"], "readwrite");
  await tx.objectStore("folders").clear();
  await tx.objectStore("meetings").clear();
  for (const f of b.folders) await tx.objectStore("folders").put(f);
  for (const m of b.meetings) await tx.objectStore("meetings").put(m);
  await tx.done;
}

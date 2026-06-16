// Web Crypto helpers for master-password encryption.

const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 200_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJSON(key: CryptoKey, data: unknown): Promise<{ iv: string; ct: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(JSON.stringify(data)),
  );
  return { iv: b64(iv), ct: b64(ct) };
}

export async function decryptJSON<T = unknown>(
  key: CryptoKey,
  payload: { iv: string; ct: string },
): Promise<T> {
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(payload.iv) },
    key,
    unb64(payload.ct),
  );
  return JSON.parse(dec.decode(pt)) as T;
}

export function randomSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16));
}

export function uid(): string {
  return crypto.randomUUID();
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  isInitialized,
  initializeMaster,
  unlockMaster,
  loadSettings,
  saveSettings,
  type Settings,
} from "@/lib/db";
import { translations, type Dict, type Lang, isRTL } from "@/lib/i18n";

interface AppCtx {
  ready: boolean;
  initialized: boolean;
  unlocked: boolean;
  masterKey: CryptoKey | null;
  settings: Settings;
  t: Dict;
  lang: Lang;
  setup: (pw: string) => Promise<void>;
  unlock: (pw: string) => Promise<boolean>;
  lock: () => void;
  updateSettings: (s: Settings) => Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [settings, setSettings] = useState<Settings>({ geminiApiKey: "", language: "he", aiRules: "" });

  useEffect(() => {
    (async () => {
      setInitialized(await isInitialized());
      setReady(true);
    })();
  }, []);

  useEffect(() => {
    const lang = settings.language;
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL(lang) ? "rtl" : "ltr";
  }, [settings.language]);

  const value = useMemo<AppCtx>(() => {
    const t = translations[settings.language];
    return {
      ready,
      initialized,
      unlocked: !!masterKey,
      masterKey,
      settings,
      t,
      lang: settings.language,
      setup: async (pw: string) => {
        const k = await initializeMaster(pw);
        const s = { geminiApiKey: "", language: settings.language, aiRules: "" };
        await saveSettings(k, s);
        setSettings(s);
        setMasterKey(k);
        setInitialized(true);
      },
      unlock: async (pw: string) => {
        const k = await unlockMaster(pw);
        if (!k) return false;
        const s = await loadSettings(k);
        setSettings(s);
        setMasterKey(k);
        return true;
      },
      lock: () => setMasterKey(null),
      updateSettings: async (s: Settings) => {
        if (!masterKey) return;
        await saveSettings(masterKey, s);
        setSettings(s);
      },
    };
  }, [ready, initialized, masterKey, settings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  isInitialized,
  initializeMaster,
  unlockMaster,
  loadSettings,
  saveSettings,
  type Settings,
} from "@/lib/db";
import { translations, type Dict, type Lang, getInitialLang, persistLang } from "@/lib/i18n";

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
  setLang: (lang: Lang) => void;
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
  const [settings, setSettings] = useState<Settings>(() => ({
    geminiApiKey: "",
    language: getInitialLang(),
    aiRules: "",
  }));

  useEffect(() => {
    persistLang(settings.language);
  }, [settings.language]);

  useEffect(() => {
    (async () => {
      setInitialized(await isInitialized());
      setReady(true);
    })();
  }, []);

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
        persistLang(s.language);
        if (!masterKey) {
          setSettings(s);
          return;
        }
        await saveSettings(masterKey, s);
        setSettings(s);
      },
      setLang: (lang: Lang) => {
        persistLang(lang);
        setSettings((s) => ({ ...s, language: lang }));
      },
    };
  }, [ready, initialized, masterKey, settings]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

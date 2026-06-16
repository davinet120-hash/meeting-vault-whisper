import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { type BeforeInstallPromptEvent, isStandalone } from "@/lib/pwa";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "vaultrecord_install_dismissed";

export function InstallBanner() {
  const { t } = useApp();
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as BeforeInstallPromptEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || !prompt) return null;

  async function install() {
    await prompt!.prompt();
    await prompt!.userChoice;
    setHidden(true);
    setPrompt(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  }

  return (
    <div className="mx-4 mt-3 rounded-xl border bg-card p-3 flex gap-3 items-start shadow-sm">
      <Download className="size-5 text-primary shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{t.installApp}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{t.installAppDesc}</p>
        <Button size="sm" className="mt-2 h-9" onClick={install}>
          {t.installAppBtn}
        </Button>
      </div>
      <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={dismiss} aria-label={t.cancel}>
        <X className="size-4" />
      </Button>
    </div>
  );
}

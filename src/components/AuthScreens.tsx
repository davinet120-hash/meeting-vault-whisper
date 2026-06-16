import { useState } from "react";
import { Shield, Lock, Languages } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SetupScreen() {
  const { setup, t } = useApp();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr(t.passwordMin);
    if (pw !== pw2) return setErr(t.passwordMismatch);
    setBusy(true);
    try {
      await setup(pw);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell icon={<Shield className="size-7" />} title={t.setupTitle} desc={t.setupDesc}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>{t.password}</Label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            className="h-12"
          />
        </div>
        <div className="space-y-2">
          <Label>{t.confirmPassword}</Label>
          <Input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="h-12"
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full h-12 text-base" disabled={busy}>
          {t.createVault}
        </Button>
      </form>
    </AuthShell>
  );
}

export function LockScreen() {
  const { unlock, t } = useApp();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const ok = await unlock(pw);
      if (!ok) setErr(t.wrongPassword);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell icon={<Lock className="size-7" />} title={t.lockTitle} desc={t.lockDesc}>
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>{t.password}</Label>
          <Input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            autoFocus
            className="h-12"
          />
        </div>
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full h-12 text-base" disabled={busy}>
          {t.unlock}
        </Button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  const { t, lang, setLang } = useApp();
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-5 py-10 bg-gradient-to-br from-background via-background to-accent/30">
      <div className="w-full max-w-md relative">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute -top-2 end-0 gap-1.5 text-muted-foreground"
          onClick={() => setLang(lang === "he" ? "en" : "he")}
          aria-label={t.toggleLang}
        >
          <Languages className="size-4" />
          {lang === "he" ? t.english : t.hebrew}
        </Button>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center size-14 rounded-2xl bg-primary text-primary-foreground mb-4 shadow-lg shadow-primary/20">
            {icon}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{t.appName}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t.tagline}</p>
        </div>
        <div className="bg-card border rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold mb-1">{title}</h2>
          <p className="text-sm text-muted-foreground mb-5">{desc}</p>
          {children}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-6 leading-relaxed">
          {t.privacyNotice}
        </p>
      </div>
    </div>
  );
}

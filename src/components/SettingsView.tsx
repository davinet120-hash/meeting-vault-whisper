import { useRef } from "react";
import { ArrowLeft, Download, Upload, Info, Shield } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { exportBackup, importBackup, type Backup } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function SettingsView({ onClose }: { onClose: () => void }) {
  const { t, settings, updateSettings } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  async function onExport() {
    const b = await exportBackup();
    const blob = new Blob([JSON.stringify(b, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vaultrecord-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as Backup;
      await importBackup(data);
      toast.success("Imported. Reloading…");
      setTimeout(() => location.reload(), 800);
    } catch {
      toast.error("Invalid backup file");
    }
  }

  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-30 glass border-b">
        <div className="flex items-center gap-2 px-2 h-14">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t.back}>
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Button>
          <h1 className="font-semibold">{t.settings}</h1>
        </div>
      </header>

      <div className="px-4 mt-4 space-y-5">
        <section className="bg-card border rounded-xl p-4 space-y-3">
          <Label className="text-sm font-semibold">{t.language}</Label>
          <Select
            value={settings.language}
            onValueChange={(v) => updateSettings({ ...settings, language: v as "en" | "he" })}
          >
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">{t.english}</SelectItem>
              <SelectItem value="he">{t.hebrew}</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="bg-card border rounded-xl p-4 space-y-3">
          <Label className="text-sm font-semibold">{t.apiKey}</Label>
          <p className="text-xs text-muted-foreground">{t.apiKeyDesc}</p>
          <Input
            type="password"
            value={settings.geminiApiKey}
            onChange={(e) => updateSettings({ ...settings, geminiApiKey: e.target.value })}
            placeholder="AIza…"
            className="h-11"
          />
        </section>

        <section className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Download className="size-4" /> {t.exportDb}
          </div>
          <p className="text-xs text-muted-foreground">{t.exportDbDesc}</p>
          <Button variant="secondary" onClick={onExport} className="w-full h-11">
            <Download className="size-4" /> {t.exportDb}
          </Button>
        </section>

        <section className="bg-card border rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Upload className="size-4" /> {t.importDb}
          </div>
          <p className="text-xs text-muted-foreground">{t.importDbDesc}</p>
          <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={onImport} />
          <Button variant="secondary" onClick={() => fileRef.current?.click()} className="w-full h-11">
            <Upload className="size-4" /> {t.importDb}
          </Button>
        </section>

        <section className="bg-card border rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="size-4" /> {t.about}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{t.aboutText}</p>
          <p className="text-xs text-muted-foreground leading-relaxed flex gap-2 pt-2 border-t">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span>{t.privacyNotice}</span>
          </p>
        </section>
      </div>
    </div>
  );
}

import { ScrollArea } from "@/components/ui/scroll-area";
import { useApp } from "@/lib/app-context";
import type { ProcessLogEntry } from "@/lib/db";
import { cn } from "@/lib/utils";
import { AlertCircle, Info, Terminal, AlertTriangle } from "lucide-react";

interface Props {
  entries: ProcessLogEntry[];
  open: boolean;
}

function LevelIcon({ level }: { level: ProcessLogEntry["level"] }) {
  if (level === "error") return <AlertCircle className="size-3.5 text-destructive shrink-0" />;
  if (level === "warn") return <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />;
  return <Info className="size-3.5 text-primary shrink-0" />;
}

export function ProcessLogPanel({ entries, open }: Props) {
  const { t } = useApp();
  if (!open) return null;

  return (
    <div className="mx-4 mt-3 rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/40 text-sm font-medium">
        <Terminal className="size-4" />
        {t.processLog}
        <span className="text-xs text-muted-foreground font-normal ms-auto">{entries.length}</span>
      </div>
      <ScrollArea className="h-36">
        <div className="p-2 space-y-1 font-mono text-xs">
          {entries.length === 0 ? (
            <p className="text-muted-foreground p-2">{t.processLogEmpty}</p>
          ) : (
            entries.map((e, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 items-start rounded px-2 py-1",
                  e.level === "error" && "bg-destructive/10",
                  e.level === "warn" && "bg-amber-500/10",
                )}
              >
                <LevelIcon level={e.level} />
                <span className="text-muted-foreground shrink-0">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
                <span className="break-all">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

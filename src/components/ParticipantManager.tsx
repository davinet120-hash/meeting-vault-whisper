import { useState } from "react";
import { UserPlus, X, Users } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "@/components/ui/sheet";

interface Props {
  participants: string[];
  onChange: (next: string[]) => void;
  /** Block recording until at least one participant is set */
  requireBeforeRecord?: boolean;
  showSetupModal: boolean;
  onCloseSetupModal: () => void;
}

export function ParticipantManager({
  participants,
  onChange,
  requireBeforeRecord,
  showSetupModal,
  onCloseSetupModal,
}: Props) {
  const { t } = useApp();
  const [draft, setDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  function addName(name?: string) {
    const n = (name ?? draft).trim();
    if (!n || participants.includes(n)) return;
    onChange([...participants, n]);
    setDraft("");
  }

  function removeName(name: string) {
    onChange(participants.filter((p) => p !== name));
  }

  const list = (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t.participantNamePh}
          className="h-10"
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addName())}
        />
        <Button type="button" size="icon" className="shrink-0" onClick={() => addName()} aria-label={t.addParticipant}>
          <UserPlus className="size-4" />
        </Button>
      </div>
      {participants.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t.noParticipants}</p>
      ) : (
        <ul className="space-y-2">
          {participants.map((p) => (
            <li key={p} className="flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2">
              <span className="text-sm font-medium">{p}</span>
              <Button variant="ghost" size="icon" className="size-8" onClick={() => removeName(p)} aria-label={t.delete}>
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="secondary"
        size="sm"
        className="gap-1 hidden sm:inline-flex"
        onClick={() => setSheetOpen(true)}
      >
        <UserPlus className="size-4" />
        <span className="max-w-24 truncate">{t.addParticipant}</span>
      </Button>
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Users className="size-4" />
            {t.participants}
            {participants.length > 0 && (
              <span className="rounded-full bg-primary text-primary-foreground text-xs px-1.5 min-w-5 h-5 grid place-items-center">
                {participants.length}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="start" className="w-80">
          <SheetHeader>
            <SheetTitle>{t.participantManager}</SheetTitle>
          </SheetHeader>
          <div className="mt-4">{list}</div>
        </SheetContent>
      </Sheet>

      <Dialog open={showSetupModal} onOpenChange={(o) => !o && onCloseSetupModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.participantSetupTitle}</DialogTitle>
            <DialogDescription>{t.participantSetupDesc}</DialogDescription>
          </DialogHeader>
          {list}
          <DialogFooter>
            <Button
              onClick={onCloseSetupModal}
              disabled={requireBeforeRecord && participants.length === 0}
              className="w-full sm:w-auto"
            >
              {t.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

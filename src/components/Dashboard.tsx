import { useCallback, useEffect, useState } from "react";
import {
  Plus, Folder as FolderIcon, FileText, Trash2, Search, Lock, Settings as SettingsIcon, MoreVertical,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  listFolders, listMeetings, createFolder, deleteFolder, deleteMeeting,
  type Folder, type Meeting,
} from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  onOpenMeeting: (id: string | "new") => void;
  onOpenSettings: () => void;
}

export function Dashboard({ onOpenMeeting, onOpenSettings }: Props) {
  const { t, lock } = useApp();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | "all" | "unfiled">("all");
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [q, setQ] = useState("");

  const refresh = useCallback(async () => {
    setFolders(await listFolders());
    setMeetings(await listMeetings());
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const filtered = meetings
    .filter((m) =>
      activeFolder === "all" ? true
      : activeFolder === "unfiled" ? m.folderId === null
      : m.folderId === activeFolder)
    .filter((m) => !q || m.title.toLowerCase().includes(q.toLowerCase()));

  async function addFolder() {
    if (!newFolderName.trim()) return;
    await createFolder(newFolderName.trim());
    setNewFolderName("");
    setShowNewFolder(false);
    refresh();
  }

  return (
    <div className="min-h-dvh pb-28">
      <header className="sticky top-0 z-30 glass border-b">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center text-sm font-bold">V</div>
            <h1 className="font-semibold">{t.appName}</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={onOpenSettings} aria-label={t.settings}>
              <SettingsIcon className="size-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={lock} aria-label={t.lock}>
              <Lock className="size-5" />
            </Button>
          </div>
        </div>
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="size-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t.search}
              className="ps-9 h-11"
            />
          </div>
        </div>
      </header>

      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{t.folders}</h2>
          <Button size="sm" variant="ghost" onClick={() => setShowNewFolder(true)}>
            <Plus className="size-4" /> {t.addFolder}
          </Button>
        </div>
        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-2 scroll-px-4 snap-x">
          <Chip active={activeFolder === "all"} onClick={() => setActiveFolder("all")}>
            <FileText className="size-3.5" /> {t.allMeetings}
          </Chip>
          <Chip active={activeFolder === "unfiled"} onClick={() => setActiveFolder("unfiled")}>
            {t.unfiled}
          </Chip>
          {folders.map((f) => (
            <Chip key={f.id} active={activeFolder === f.id} onClick={() => setActiveFolder(f.id)}
              onDelete={async () => { await deleteFolder(f.id); refresh(); }}>
              <FolderIcon className="size-3.5" /> {f.name}
            </Chip>
          ))}
        </div>
      </div>

      <div className="px-4 mt-6 space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <FileText className="size-12 mx-auto mb-3 opacity-40" />
            <p>{t.noMeetings}</p>
          </div>
        ) : (
          filtered.map((m) => (
            <button
              key={m.id}
              onClick={() => onOpenMeeting(m.id)}
              className="w-full text-start bg-card border rounded-xl p-4 hover:border-primary/40 transition-colors active:scale-[0.99] flex items-center gap-3"
            >
              <div className="size-10 rounded-lg bg-accent grid place-items-center shrink-0">
                <FileText className="size-5 text-accent-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.title || t.untitled}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(m.updatedAt).toLocaleString()}
                </div>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button onClick={(e) => e.stopPropagation()} className="size-8 grid place-items-center rounded-md hover:bg-muted">
                    <MoreVertical className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={async (e) => { e.stopPropagation(); await deleteMeeting(m.id); refresh(); }}
                  >
                    <Trash2 className="size-4" /> {t.delete}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </button>
          ))
        )}
      </div>

      <div className="fixed bottom-6 inset-x-0 px-4 z-40">
        <Button
          size="lg"
          className="w-full h-14 text-base rounded-2xl shadow-lg shadow-primary/30"
          onClick={() => onOpenMeeting("new")}
        >
          <Plus className="size-5" /> {t.newMeeting}
        </Button>
      </div>

      <Dialog open={showNewFolder} onOpenChange={setShowNewFolder}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.addFolder}</DialogTitle>
          </DialogHeader>
          <Input
            placeholder={t.folderName}
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowNewFolder(false)}>{t.cancel}</Button>
            <Button onClick={addFolder}>{t.create}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Chip({
  active, onClick, onDelete, children,
}: {
  active: boolean; onClick: () => void; onDelete?: () => void; children: React.ReactNode;
}) {
  return (
    <div
      className={`shrink-0 snap-start inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-sm border transition-colors ${
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card border-border hover:bg-accent"
      }`}
    >
      <button onClick={onClick} className="inline-flex items-center gap-1.5">
        {children}
      </button>
      {onDelete && (
        <button onClick={onDelete} className="opacity-60 hover:opacity-100 ms-1" aria-label="delete">
          <Trash2 className="size-3" />
        </button>
      )}
    </div>
  );
}

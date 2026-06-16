import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft, Mic, Square, Upload, Sparkles, Save, Download, FileText, ListTodo, Users,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  listFolders, loadMeetingContent, saveMeeting, type Folder, type Meeting, type MeetingContent, listMeetings,
} from "@/lib/db";
import { processAudio, processText } from "@/lib/gemini";
import { exportMeetingPdf } from "@/lib/pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Props {
  meetingId: string | "new";
  onClose: () => void;
}

const EMPTY: MeetingContent = { transcript: "", protocol: null, notes: "" };

export function MeetingView({ meetingId, onClose }: Props) {
  const { t, masterKey, settings } = useApp();
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [content, setContent] = useState<MeetingContent>(EMPTY);
  const [pasted, setPasted] = useState("");
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<"input" | "transcript" | "protocol">("input");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<Blob | null>(null);
  const idRef = useRef<string | null>(meetingId === "new" ? null : meetingId);

  useEffect(() => {
    (async () => {
      setFolders(await listFolders());
      if (meetingId !== "new" && masterKey) {
        const all = await listMeetings();
        const m = all.find((x: Meeting) => x.id === meetingId);
        if (m) {
          setTitle(m.title);
          setFolderId(m.folderId);
          setContent(await loadMeetingContent(masterKey, m));
          setTab("protocol");
        }
      }
    })();
  }, [meetingId, masterKey]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        audioRef.current = blob;
        stream.getTracks().forEach((tr) => tr.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (e) {
      toast.error(String(e));
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
    toast.success("Audio captured");
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    audioRef.current = f;
    toast.success(f.name);
  }

  async function runAI() {
    if (!settings.geminiApiKey) return toast.error(t.missingKey);
    const hasAudio = !!audioRef.current;
    const hasText = pasted.trim().length > 0 || content.transcript.length > 0;
    if (!hasAudio && !hasText) return toast.error(t.needInput);
    setProcessing(true);
    try {
      const result = hasAudio
        ? await processAudio(settings.geminiApiKey, audioRef.current as Blob)
        : await processText(settings.geminiApiKey, pasted.trim() || content.transcript);
      const next: MeetingContent = {
        transcript: result.transcript,
        protocol: result.protocol,
        notes: content.notes,
      };
      setContent(next);
      if (!title) setTitle(result.protocol.title || t.untitled);
      setTab("protocol");
      await persist(next, result.protocol.title || title);
      toast.success(t.saved);
    } catch (e) {
      console.error(e);
      toast.error(t.aiError);
    } finally {
      setProcessing(false);
    }
  }

  async function persist(c: MeetingContent = content, titleOverride?: string) {
    if (!masterKey) return;
    const saved = await saveMeeting(masterKey, {
      id: idRef.current ?? undefined,
      folderId,
      title: titleOverride ?? title ?? t.untitled,
      content: c,
    });
    idRef.current = saved.id;
  }

  async function onSave() {
    await persist();
    toast.success(t.saved);
  }

  function onPdf() {
    exportMeetingPdf(title || t.untitled, content, t);
  }

  return (
    <div className="min-h-dvh pb-32">
      <header className="sticky top-0 z-30 glass border-b">
        <div className="flex items-center gap-2 px-2 h-14">
          <Button variant="ghost" size="icon" onClick={onClose} aria-label={t.back}>
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.titlePh}
            className="border-0 shadow-none focus-visible:ring-0 text-base font-medium flex-1"
          />
          <Button variant="ghost" size="icon" onClick={onSave} aria-label={t.save}>
            <Save className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onPdf} aria-label={t.exportPdf}>
            <Download className="size-5" />
          </Button>
        </div>
        {recording && (
          <div className="flex items-center justify-center gap-2 py-2 bg-destructive/10 text-destructive text-sm">
            <span className="size-2.5 rounded-full bg-destructive pulse-rec" />
            {t.recording}
          </div>
        )}
        {processing && (
          <div className="flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary text-sm">
            <Sparkles className="size-4 animate-pulse" /> {t.processing}
          </div>
        )}
      </header>

      <div className="px-4 mt-4">
        <Select value={folderId ?? "none"} onValueChange={(v) => setFolderId(v === "none" ? null : v)}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t.unfiled}</SelectItem>
            {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="mt-4">
        <div className="px-4">
          <TabsList className="w-full grid grid-cols-3 h-11">
            <TabsTrigger value="input">{t.pasteText}</TabsTrigger>
            <TabsTrigger value="transcript">{t.rawTranscript}</TabsTrigger>
            <TabsTrigger value="protocol">{t.protocol}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="input" className="px-4 mt-4 space-y-4">
          <div className="bg-card border rounded-xl p-4">
            <p className="text-xs text-muted-foreground mb-3">{t.listenNote}</p>
            <div className="flex gap-2">
              {recording ? (
                <Button onClick={stopRecording} variant="destructive" className="flex-1 h-12">
                  <Square className="size-4" /> {t.stop}
                </Button>
              ) : (
                <Button onClick={startRecording} className="flex-1 h-12">
                  <Mic className="size-4" /> {t.record}
                </Button>
              )}
              <label className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:bg-secondary/80 flex-1">
                <Upload className="size-4" /> {t.upload}
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a"
                  className="hidden"
                  onChange={onUpload}
                />
              </label>
            </div>
          </div>
          <Textarea
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder={t.pasteTextPh}
            className="min-h-48"
          />
          <Button onClick={runAI} disabled={processing} className="w-full h-12">
            <Sparkles className="size-4" /> {processing ? t.processing : t.process}
          </Button>
        </TabsContent>

        <TabsContent value="transcript" className="px-4 mt-4">
          <Textarea
            value={content.transcript}
            onChange={(e) => setContent({ ...content, transcript: e.target.value })}
            className="min-h-96 font-mono text-sm"
            placeholder="—"
          />
        </TabsContent>

        <TabsContent value="protocol" className="px-4 mt-4 space-y-4">
          {content.protocol ? <ProtocolView c={content} /> : (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="size-10 mx-auto mb-2 opacity-40" />
              <p>{t.noProtocol}</p>
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-2 block">{t.notes}</label>
            <Textarea
              value={content.notes}
              onChange={(e) => setContent({ ...content, notes: e.target.value })}
              className="min-h-32"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProtocolView({ c }: { c: MeetingContent }) {
  const { t } = useApp();
  const p = c.protocol!;
  return (
    <div className="space-y-4">
      <Section icon={<FileText className="size-4" />} title={t.summary}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap">{p.summary || "—"}</p>
      </Section>
      <Section icon={<Users className="size-4" />} title={t.participants}>
        <div className="flex flex-wrap gap-2">
          {p.participants.length === 0 && <span className="text-sm text-muted-foreground">—</span>}
          {p.participants.map((x, i) => (
            <span key={i} className="text-xs rounded-full bg-accent text-accent-foreground px-2.5 py-1">{x}</span>
          ))}
        </div>
      </Section>
      <Section icon={<FileText className="size-4" />} title={t.decisions}>
        {Object.keys(p.decisions_by_speaker).length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-3">
            {Object.entries(p.decisions_by_speaker).map(([sp, ds]) => (
              <div key={sp}>
                <div className="text-sm font-medium mb-1">{sp}</div>
                <ul className="space-y-1">
                  {ds.map((d, i) => <li key={i} className="text-sm text-muted-foreground">• {d}</li>)}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section icon={<ListTodo className="size-4" />} title={t.actionItems}>
        {p.action_items.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="space-y-2">
            {p.action_items.map((a, i) => (
              <div key={i} className="border rounded-lg p-3 bg-background">
                <div className="text-sm font-medium">{a.task}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {t.owner}: {a.owner || "—"} · {t.due}: {a.due || "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
        {icon} {title}
      </div>
      {children}
    </div>
  );
}

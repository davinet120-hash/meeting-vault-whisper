import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft, Mic, Square, Upload, Sparkles, Save, Download, FileText, ListTodo,
  Languages, Terminal, Pause, Play,
} from "lucide-react";
import { useApp } from "@/lib/app-context";
import {
  listFolders, loadMeetingContent, saveMeeting, emptyContent,
  type Folder, type Meeting, type MeetingContent, type ProcessLogEntry, listMeetings,
} from "@/lib/db";
import { processAudio, processText } from "@/lib/gemini";
import { exportMeetingPdf } from "@/lib/pdf";
import { ParticipantManager } from "@/components/ParticipantManager";
import { ProcessLogPanel } from "@/components/ProcessLogPanel";
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

type RecState = "idle" | "recording" | "paused";

export function MeetingView({ meetingId, onClose }: Props) {
  const { t, masterKey, settings, updateSettings, lang } = useApp();
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [content, setContent] = useState<MeetingContent>(emptyContent());
  const [pasted, setPasted] = useState("");
  const [recState, setRecState] = useState<RecState>("idle");
  const [processing, setProcessing] = useState(false);
  const [tab, setTab] = useState<"input" | "transcript" | "protocol">("input");
  const [showParticipantModal, setShowParticipantModal] = useState(false);
  const [showProcessLog, setShowProcessLog] = useState(false);
  const [pendingRecord, setPendingRecord] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<Blob | null>(null);
  const idRef = useRef<string | null>(meetingId === "new" ? null : meetingId);

  const participants = content.participants;

  const setParticipants = useCallback((next: string[]) => {
    setContent((c) => ({ ...c, participants: next }));
  }, []);

  const appendLog = useCallback((level: ProcessLogEntry["level"], message: string) => {
    setContent((c) => ({
      ...c,
      processLog: [...c.processLog, { ts: Date.now(), level, message }],
    }));
  }, []);

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
      } else if (meetingId === "new") {
        setShowParticipantModal(true);
      }
    })();
  }, [meetingId, masterKey]);

  async function doStartRecording() {
    try {
      appendLog("info", "Starting microphone capture…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        audioRef.current = blob;
        streamRef.current?.getTracks().forEach((tr) => tr.stop());
        streamRef.current = null;
        appendLog("info", `Recording saved (${(blob.size / 1024).toFixed(0)} KB)`);
      };
      mr.start(1000);
      mediaRecorderRef.current = mr;
      setRecState("recording");
    } catch (e) {
      appendLog("error", String(e));
      toast.error(String(e));
    }
  }

  function requestRecording() {
    if (participants.length === 0) {
      setPendingRecord(true);
      setShowParticipantModal(true);
      return;
    }
    void doStartRecording();
  }

  function onParticipantModalClose() {
    setShowParticipantModal(false);
    if (pendingRecord && participants.length > 0) {
      setPendingRecord(false);
      void doStartRecording();
    }
  }

  function pauseRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "recording") return;
    mr.pause();
    setRecState("paused");
    appendLog("info", "Recording paused");
  }

  function resumeRecording() {
    const mr = mediaRecorderRef.current;
    if (!mr || mr.state !== "paused") return;
    mr.resume();
    setRecState("recording");
    appendLog("info", "Recording resumed");
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecState("idle");
    toast.success(t.saved);
  }

  function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    audioRef.current = f;
    appendLog("info", `Audio file loaded: ${f.name}`);
    toast.success(f.name);
  }

  async function runAI() {
    if (!settings.geminiApiKey) return toast.error(t.missingKey);
    const hasAudio = !!audioRef.current;
    const hasText = pasted.trim().length > 0 || content.transcript.length > 0;
    if (!hasAudio && !hasText) return toast.error(t.needInput);

    setProcessing(true);
    setShowProcessLog(true);
    appendLog("info", "AI processing started");

    const opts = {
      participants,
      aiRules: settings.aiRules,
    };
    const log = (level: ProcessLogEntry["level"], message: string) => appendLog(level, message);

    try {
      const result = hasAudio
        ? await processAudio(settings.geminiApiKey, audioRef.current as Blob, opts, log)
        : await processText(settings.geminiApiKey, pasted.trim() || content.transcript, opts, log);

      const mergedParticipants = [
        ...new Set([...participants, ...(result.protocol.participants ?? [])]),
      ];

      const next: MeetingContent = {
        transcript: result.transcript,
        protocol: result.protocol,
        notes: content.notes,
        participants: mergedParticipants,
        processLog: content.processLog,
      };
      setContent((c) => ({ ...next, processLog: [...c.processLog, { ts: Date.now(), level: "info", message: "Processing complete" }] }));
      if (!title) setTitle(result.protocol.title || t.untitled);
      setTab("protocol");
      await persist(next, result.protocol.title || title);
      toast.success(t.saved);
    } catch (e) {
      console.error(e);
      appendLog("error", String(e));
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

  function toggleLang() {
    const next = lang === "en" ? "he" : "en";
    void updateSettings({ ...settings, language: next });
  }

  return (
    <div className="min-h-dvh pb-36">
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
          <ParticipantManager
            participants={participants}
            onChange={setParticipants}
            requireBeforeRecord
            showSetupModal={showParticipantModal}
            onCloseSetupModal={onParticipantModalClose}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowProcessLog((v) => !v)}
            aria-label={t.processLog}
            className={showProcessLog ? "text-primary" : ""}
          >
            <Terminal className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleLang} aria-label={t.toggleLang}>
            <Languages className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onSave} aria-label={t.save}>
            <Save className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onPdf} aria-label={t.exportPdf}>
            <Download className="size-5" />
          </Button>
        </div>
        {recState === "recording" && (
          <div className="flex items-center justify-center gap-2 py-2 bg-destructive/10 text-destructive text-sm">
            <span className="size-2.5 rounded-full bg-destructive pulse-rec" />
            {t.recording}
            <span className="text-xs opacity-70">
              · {participants.join(", ") || "—"}
            </span>
          </div>
        )}
        {recState === "paused" && (
          <div className="flex items-center justify-center gap-2 py-2 bg-amber-500/15 text-amber-700 dark:text-amber-400 text-sm">
            <Pause className="size-4" />
            {t.paused}
            <span className="text-xs opacity-70">
              · {participants.join(", ") || "—"}
            </span>
          </div>
        )}
        {processing && (
          <div className="flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary text-sm">
            <Sparkles className="size-4 animate-pulse" /> {t.processing}
          </div>
        )}
      </header>

      <ProcessLogPanel entries={content.processLog} open={showProcessLog} />

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
            <label className="inline-flex items-center justify-center gap-2 h-12 px-4 rounded-md bg-secondary text-secondary-foreground text-sm font-medium cursor-pointer hover:bg-secondary/80 w-full">
              <Upload className="size-4" /> {t.upload}
              <input
                type="file"
                accept="audio/*,.mp3,.wav,.m4a"
                className="hidden"
                onChange={onUpload}
              />
            </label>
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

        <TabsContent value="transcript" className="px-4 mt-4 space-y-2">
          <p className="text-xs text-muted-foreground">{t.verbatimNote}</p>
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

      {/* Floating record controls */}
      <div className="fixed bottom-6 inset-x-0 z-40 flex justify-center pointer-events-none px-4">
        {recState === "idle" ? (
          <Button
            onClick={requestRecording}
            size="lg"
            className="pointer-events-auto h-16 w-16 rounded-full shadow-2xl shadow-primary/40 p-0"
            aria-label={t.record}
          >
            <Mic className="size-7" />
          </Button>
        ) : (
          <div className="pointer-events-auto flex items-center gap-4">
            {recState === "recording" ? (
              <Button
                onClick={pauseRecording}
                variant="secondary"
                size="lg"
                className="h-14 w-14 rounded-full shadow-xl p-0"
                aria-label={t.pause}
              >
                <Pause className="size-6" />
              </Button>
            ) : (
              <Button
                onClick={resumeRecording}
                size="lg"
                className="h-14 w-14 rounded-full shadow-xl shadow-primary/40 p-0"
                aria-label={t.resume}
              >
                <Play className="size-6 fill-current" />
              </Button>
            )}
            <Button
              onClick={stopRecording}
              variant="destructive"
              size="lg"
              className="h-16 w-16 rounded-full shadow-2xl shadow-destructive/30 p-0"
              aria-label={t.stop}
            >
              <Square className="size-7 fill-current" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProtocolView({ c }: { c: MeetingContent }) {
  const { t } = useApp();
  const p = c.protocol!;
  return (
    <div className="space-y-4">
      {p.date && (
        <p className="text-xs text-muted-foreground">{t.date}: {p.date}</p>
      )}
      <Section icon={<FileText className="size-4" />} title={t.summary}>
        {p.summary_bullets.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <ul className="space-y-1">
            {p.summary_bullets.map((b, i) => (
              <li key={i} className="text-sm leading-relaxed">• {b}</li>
            ))}
          </ul>
        )}
      </Section>
      <Section icon={<Users className="size-4" />} title={t.participants}>
        <div className="flex flex-wrap gap-2">
          {(p.participants.length ? p.participants : c.participants).length === 0 && (
            <span className="text-sm text-muted-foreground">—</span>
          )}
          {(p.participants.length ? p.participants : c.participants).map((x, i) => (
            <span key={i} className="text-xs rounded-full bg-accent text-accent-foreground px-2.5 py-1">{x}</span>
          ))}
        </div>
      </Section>
      <Section icon={<FileText className="size-4" />} title={t.decisions}>
        {p.decisions_table.length === 0 ? (
          <p className="text-sm text-muted-foreground">—</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-start py-2 pe-2 font-medium">{t.decisions}</th>
                  <th className="text-start py-2 pe-2 font-medium">{t.owner}</th>
                  <th className="text-start py-2 font-medium">{t.deadline}</th>
                </tr>
              </thead>
              <tbody>
                {p.decisions_table.map((d, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pe-2">{d.decision}</td>
                    <td className="py-2 pe-2 text-muted-foreground">{d.owner || "—"}</td>
                    <td className="py-2 text-muted-foreground">{d.deadline || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
                  {t.assignee}: {a.assignee || "—"} · {t.priority}: {a.priority || "—"}
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

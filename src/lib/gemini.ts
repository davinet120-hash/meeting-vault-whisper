import { splitAudioBlob } from "./audio-segment";
import type { MeetingProtocol, ProcessLogEntry } from "./db";

const MODEL = "gemini-2.5-flash";
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

export interface GeminiOptions {
  participants: string[];
  aiRules?: string;
  segmentIndex?: number;
  segmentTotal?: number;
}

export interface GeminiResult {
  transcript: string;
  protocol: MeetingProtocol;
}

export type LogFn = (level: ProcessLogEntry["level"], message: string) => void;

interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

function buildSystemPrompt(opts: GeminiOptions, mode: "transcribe" | "full"): string {
  const participantList =
    opts.participants.length > 0
      ? opts.participants.join(", ")
      : "(none provided — use [Unknown Speaker] when unsure)";

  const segmentNote =
    opts.segmentIndex != null && opts.segmentTotal != null && opts.segmentTotal > 1
      ? `\nThis is audio segment ${opts.segmentIndex + 1} of ${opts.segmentTotal}. Continue speaker labels consistently across segments.`
      : "";

  const verbatimRules = `STRICT VERBATIM PROTOCOL:
- The transcript must be 1:1 verbatim — every word spoken, no summarization, no paraphrasing.
- Before EVERY single line in the verbatim transcript, prepend the speaker's name in bold markdown: **[Speaker Name]:** [Text]
- Use the Participant List to map voices to names: ${participantList}
- If you cannot identify a speaker, use **[Unknown Speaker]:**
- Output language must strictly match the detected input language (Hebrew or English).${segmentNote}`;

  const protocolRules = `EXECUTIVE PROTOCOL ENGINE:
Produce a structured meeting protocol as JSON with this EXACT shape:
{
  "title": "string",
  "date": "string (meeting date if known, else today)",
  "participants": ["string"],
  "summary_bullets": ["string"],
  "decisions_table": [{"decision": "string", "owner": "string", "deadline": "string"}],
  "action_items": [{"task": "string", "assignee": "string", "priority": "string"}]
}
Use the Participant List for attribution. Output language must match the transcript language.`;

  const customRules = opts.aiRules?.trim()
    ? `\n\nCUSTOM AI RULES (follow strictly):\n${opts.aiRules.trim()}`
    : "";

  if (mode === "transcribe") {
    return `You are a high-precision meeting transcription engine.${verbatimRules}${customRules}

Return ONLY a JSON object: { "transcript": "string" } — no markdown fences, no commentary.`;
  }

  return `You are an expert executive assistant for meeting analysis.
${verbatimRules}

${protocolRules}${customRules}

Return ONLY a single JSON object with this exact shape, no markdown fences, no commentary:
{
  "transcript": "string with **[Speaker Name]:** labels on every line",
  "protocol": {
    "title": "string",
    "date": "string",
    "participants": ["string"],
    "summary_bullets": ["string"],
    "decisions_table": [{"decision": "string", "owner": "string", "deadline": "string"}],
    "action_items": [{"task": "string", "assignee": "string", "priority": "string"}]
  }
}`;
}

function extractJSON(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found in AI response");
  return JSON.parse(raw.slice(start, end + 1));
}

async function callGemini(
  apiKey: string,
  parts: Part[],
  systemPrompt: string,
  log?: LogFn,
): Promise<string> {
  log?.("info", "Sending request to Gemini API…");
  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
  };
  const res = await fetch(ENDPOINT(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    log?.("error", `Gemini HTTP ${res.status}: ${t.slice(0, 200)}`);
    throw new Error(`Gemini ${res.status}: ${t}`);
  }
  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: Part) => p.text ?? "").join("") ?? "";
  if (!text) {
    log?.("error", "Empty response from Gemini");
    throw new Error("Empty Gemini response");
  }
  log?.("info", "Received AI response");
  return text;
}

function parseProtocol(raw: Partial<{ protocol?: Partial<MeetingProtocol> }>): MeetingProtocol {
  const p = raw.protocol ?? {};
  return {
    title: p.title ?? "",
    date: p.date ?? new Date().toLocaleDateString(),
    participants: p.participants ?? [],
    summary_bullets: p.summary_bullets ?? [],
    decisions_table: (p.decisions_table ?? []).map((d) => ({
      decision: d.decision ?? "",
      owner: d.owner ?? "",
      deadline: d.deadline ?? "",
    })),
    action_items: (p.action_items ?? []).map((a) => ({
      task: a.task ?? "",
      assignee: a.assignee ?? "",
      priority: a.priority ?? "",
    })),
  };
}

async function transcribeSegment(
  apiKey: string,
  audioBlob: Blob,
  opts: GeminiOptions,
  log?: LogFn,
): Promise<string> {
  const base64 = await blobToBase64(audioBlob);
  const prompt = buildSystemPrompt(opts, "transcribe");
  const text = await callGemini(
    apiKey,
    [
      {
        text: `Transcribe this meeting audio verbatim. Known participants: ${opts.participants.join(", ") || "none"}.`,
      },
      { inline_data: { mime_type: audioBlob.type || "audio/wav", data: base64 } },
    ],
    prompt,
    log,
  );
  const parsed = extractJSON(text) as { transcript?: string };
  return parsed.transcript ?? "";
}

async function generateFromTranscript(
  apiKey: string,
  transcript: string,
  opts: GeminiOptions,
  log?: LogFn,
): Promise<GeminiResult> {
  const prompt = buildSystemPrompt(opts, "full");
  const participantHint =
    opts.participants.length > 0
      ? `\n\nParticipant List: ${opts.participants.join(", ")}`
      : "";
  const text = await callGemini(
    apiKey,
    [{ text: `Analyze this verbatim meeting transcript and produce protocol:\n\n${transcript}${participantHint}` }],
    prompt,
    log,
  );
  const parsed = extractJSON(text) as Partial<GeminiResult & { protocol?: Partial<MeetingProtocol> }>;
  return {
    transcript: parsed.transcript ?? transcript,
    protocol: parseProtocol(parsed),
  };
}

export async function processText(
  apiKey: string,
  text: string,
  opts: GeminiOptions,
  log?: LogFn,
): Promise<GeminiResult> {
  log?.("info", "Processing text input…");
  return generateFromTranscript(apiKey, text, opts, log);
}

export async function processAudio(
  apiKey: string,
  audioBlob: Blob,
  opts: GeminiOptions,
  log?: LogFn,
): Promise<GeminiResult> {
  log?.("info", `Audio blob: ${(audioBlob.size / 1024 / 1024).toFixed(2)} MB, type=${audioBlob.type || "unknown"}`);

  const segments = await splitAudioBlob(audioBlob, (m) => log?.("info", m));
  const transcripts: string[] = [];

  for (let i = 0; i < segments.length; i++) {
    log?.("info", `Transcribing segment ${i + 1}/${segments.length}…`);
    const segOpts = { ...opts, segmentIndex: i, segmentTotal: segments.length };
    try {
      const t = await transcribeSegment(apiKey, segments[i], segOpts, log);
      transcripts.push(t);
      log?.("info", `Segment ${i + 1} done (${t.length} chars)`);
    } catch (e) {
      log?.("error", `Segment ${i + 1} failed: ${String(e)}`);
      throw e;
    }
  }

  const merged = transcripts.join("\n\n");
  log?.("info", `Merged transcript: ${merged.length} chars. Generating protocol…`);
  return generateFromTranscript(apiKey, merged, opts, log);
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

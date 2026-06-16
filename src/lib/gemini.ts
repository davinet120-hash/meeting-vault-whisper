import type { MeetingProtocol } from "./db";

export const SYSTEM_PROMPT = `You are an expert executive assistant. Analyze the input. First, identify speakers based on introductions. Provide:
1. A clean transcript with speaker labels.
2. A structured protocol: { "title": string, "participants": string[], "summary": string, "decisions_by_speaker": { "speaker": string[] }, "action_items": [{ "task": string, "owner": string, "due": string }] }.
Output language must match the input language (Hebrew or English).`;

const RESPONSE_INSTRUCTION = `Return ONLY a single JSON object with this exact shape, no markdown, no commentary:
{
  "transcript": "string with speaker labels like 'Alice: ...' on new lines",
  "protocol": {
    "title": "string",
    "participants": ["string"],
    "summary": "string",
    "decisions_by_speaker": { "Speaker Name": ["decision"] },
    "action_items": [{ "task": "string", "owner": "string", "due": "string" }]
  }
}`;

const MODEL = "gemini-2.5-flash";
const ENDPOINT = (key: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;

export interface GeminiResult {
  transcript: string;
  protocol: MeetingProtocol;
}

interface Part {
  text?: string;
  inline_data?: { mime_type: string; data: string };
}

function extractJSON(text: string): unknown {
  // strip ```json fences if any
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

async function callGemini(apiKey: string, parts: Part[]): Promise<GeminiResult> {
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT + "\n\n" + RESPONSE_INSTRUCTION }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
  };
  const res = await fetch(ENDPOINT(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Gemini ${res.status}: ${t}`);
  }
  const json = await res.json();
  const text: string =
    json?.candidates?.[0]?.content?.parts?.map((p: Part) => p.text ?? "").join("") ?? "";
  const parsed = extractJSON(text) as Partial<GeminiResult>;
  return {
    transcript: parsed.transcript ?? "",
    protocol: {
      title: parsed.protocol?.title ?? "",
      participants: parsed.protocol?.participants ?? [],
      summary: parsed.protocol?.summary ?? "",
      decisions_by_speaker: parsed.protocol?.decisions_by_speaker ?? {},
      action_items: parsed.protocol?.action_items ?? [],
    },
  };
}

export async function processText(apiKey: string, text: string): Promise<GeminiResult> {
  return callGemini(apiKey, [
    { text: `Here is the meeting transcript or notes:\n\n${text}` },
  ]);
}

export async function processAudio(
  apiKey: string,
  audioBlob: Blob,
): Promise<GeminiResult> {
  const base64 = await blobToBase64(audioBlob);
  return callGemini(apiKey, [
    { text: "Transcribe and analyze the following meeting audio." },
    { inline_data: { mime_type: audioBlob.type || "audio/webm", data: base64 } },
  ]);
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

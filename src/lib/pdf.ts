import jsPDF from "jspdf";
import type { MeetingContent } from "./db";
import type { Dict } from "./i18n";

export function exportMeetingPdf(
  title: string,
  content: MeetingContent,
  t: Dict,
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const line = (text: string, size = 11, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text || "", maxWidth) as string[];
    for (const ln of lines) {
      if (y > 780) {
        doc.addPage();
        y = margin;
      }
      doc.text(ln, margin, y);
      y += size * 1.35;
    }
  };
  const gap = (n = 8) => (y += n);

  line(title || t.untitled, 20, true);
  gap(6);
  line(new Date().toLocaleString(), 9);
  gap(10);

  const p = content.protocol;
  if (p) {
    line(t.summary, 13, true);
    line(p.summary || "—");
    gap();
    line(t.participants, 13, true);
    line(p.participants.join(", ") || "—");
    gap();
    line(t.decisions, 13, true);
    const entries = Object.entries(p.decisions_by_speaker);
    if (entries.length === 0) line("—");
    for (const [sp, decisions] of entries) {
      line(sp, 11, true);
      for (const d of decisions) line("• " + d);
      gap(4);
    }
    gap();
    line(t.actionItems, 13, true);
    if (p.action_items.length === 0) line("—");
    for (const a of p.action_items) {
      line(`• ${a.task}  —  ${t.owner}: ${a.owner || "—"}  |  ${t.due}: ${a.due || "—"}`);
    }
    gap(14);
  }

  line(t.rawTranscript, 13, true);
  line(content.transcript || "—", 10);

  if (content.notes) {
    gap(10);
    line(t.notes, 13, true);
    line(content.notes, 10);
  }

  const safe = (title || "meeting").replace(/[^a-z0-9\u0590-\u05ff\- _]/gi, "_");
  doc.save(`${safe}.pdf`);
}

// RFC 5545 naptár-feed (§12.8). Tiszta függvények: az adatot az `ics_feed` RPC adja.

export type IcsEvent = {
  uid: string;
  dueDate: string; // YYYY-MM-DD
  summary: string;
  description?: string;
  /** emlékeztető hány nappal előtte (null = nincs VALARM) */
  alarmDays: number | null;
};

const encoder = new TextEncoder();

export function escapeText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

// 75 oktettes sortörés: a folytatósor szóközzel kezdődik; többbájtos karaktert nem vág ketté
export function foldLine(line: string): string {
  if (encoder.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let current = "";
  let bytes = 0;
  let limit = 75;
  for (const ch of line) {
    const size = encoder.encode(ch).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = "";
      bytes = 0;
      limit = 74; // a folytatósor elején lévő szóköz is számít
    }
    current += ch;
    bytes += size;
  }
  parts.push(current);
  return parts.join("\r\n ");
}

const compact = (isoDate: string) => isoDate.replaceAll("-", "");

function nextDay(isoDate: string): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const stamp = (now: Date) => now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export function buildIcs(events: IcsEvent[], now: Date = new Date()): string {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bank Reminder//HU//",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Bank Reminder",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART;VALUE=DATE:${compact(e.dueDate)}`,
      `DTEND;VALUE=DATE:${compact(nextDay(e.dueDate))}`,
      `SUMMARY:${escapeText(e.summary)}`,
    );
    // megjegyzés szándékosan nincs a feedben: érzékeny adat minimalizálása
    if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
    if (e.alarmDays !== null) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${escapeText(e.summary)}`,
        `TRIGGER:${e.alarmDays <= 0 ? "PT0S" : `-P${e.alarmDays}D`}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

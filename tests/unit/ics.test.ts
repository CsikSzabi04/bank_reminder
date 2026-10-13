import { describe, expect, it } from "vitest";
import { buildIcs, escapeText, foldLine } from "@/lib/ics";

const NOW = new Date("2026-10-13T08:00:00Z");
const ev = (over = {}) => ({ uid: "occ-1@bankreminder", dueDate: "2026-11-10", summary: "Netflix — 2 300 Ft", alarmDays: 1, ...over });

describe("escapeText", () => {
  it("vessző, pontosvessző, backslash és újsor escape-elve", () => {
    expect(escapeText("a,b;c\\d\ne")).toBe("a\\,b\\;c\\\\d\\ne");
  });
});

describe("foldLine (75 oktett)", () => {
  it("rövid sort nem bont", () => {
    expect(foldLine("SUMMARY:x")).toBe("SUMMARY:x");
  });
  it("hosszú sort CRLF + szóközzel bont, egy sor sem > 75 oktett", () => {
    const folded = foldLine("SUMMARY:" + "a".repeat(200));
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, "")).toBe("SUMMARY:" + "a".repeat(200));
  });
  it("többbájtos karaktert nem vág ketté", () => {
    const text = "SUMMARY:" + "ő".repeat(100);
    const folded = foldLine(text);
    expect(folded.replace(/\r\n /g, "")).toBe(text);
    for (const l of folded.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
  });
});

describe("buildIcs", () => {
  it("érvényes keret, CRLF sorvégek, teljes napos esemény és VALARM", () => {
    const ics = buildIcs([ev()], NOW);
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).not.toMatch(/[^\r]\n/); // nincs önálló LF
    expect(ics).toContain("DTSTART;VALUE=DATE:20261110\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20261111\r\n");
    expect(ics).toContain("UID:occ-1@bankreminder\r\n");
    expect(ics).toContain("DTSTAMP:20261013T080000Z\r\n");
    expect(ics).toContain("TRIGGER:-P1D\r\n");
  });
  it("hónapvégi esemény DTEND-je átlépi a hónapot és az évet", () => {
    expect(buildIcs([ev({ dueDate: "2026-12-31" })], NOW)).toContain("DTEND;VALUE=DATE:20270101");
  });
  it("aznapi emlékeztető PT0S; riasztás nélkül nincs VALARM", () => {
    expect(buildIcs([ev({ alarmDays: 0 })], NOW)).toContain("TRIGGER:PT0S");
    expect(buildIcs([ev({ alarmDays: null })], NOW)).not.toContain("VALARM");
  });
  it("a feedben nincs megjegyzés/link, a szöveg escape-elve", () => {
    const ics = buildIcs([ev({ summary: "A,B;C" })], NOW);
    expect(ics).toContain("SUMMARY:A\\,B\\;C");
    expect(ics).not.toContain("NOTE");
  });
  it("üres feed is érvényes naptár", () => {
    const ics = buildIcs([], NOW);
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).not.toContain("VEVENT");
  });
});

import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatMoney,
  formatMoneyCompact,
  formatPercent,
  formatRelativeDay,
  todayIn,
} from "@/lib/format";

// Az Intl NBSP-t / keskeny NBSP-t használ: snapshot helyett normalizálunk (§20.3)
const norm = (s: string) => s.replace(/[  ]/g, " ");

describe("formatMoney", () => {
  it("HUF: 0 tizedes, HU és EN", () => {
    expect(norm(formatMoney(2300, "HUF", "hu"))).toBe("2 300 Ft");
    expect(norm(formatMoney(2300, "HUF", "en"))).toBe("HUF 2,300");
  });
  it("EUR: 2 tizedes, HU és EN", () => {
    expect(norm(formatMoney(12.5, "EUR", "hu"))).toBe("12,50 EUR");
    expect(norm(formatMoney(12.5, "EUR", "en"))).toBe("€12.50");
  });
});

describe("formatMoneyCompact", () => {
  it("kompakt tengelyfelirat", () => {
    expect(norm(formatMoneyCompact(1_200_000, "HUF", "hu"))).toBe("1,2 M Ft");
    expect(norm(formatMoneyCompact(1_200_000, "HUF", "en"))).toBe("HUF 1.2M");
  });
});

describe("formatPercent", () => {
  it("egész százalék", () => {
    expect(norm(formatPercent(0.31, "hu"))).toBe("31%");
    expect(norm(formatPercent(0.31, "en"))).toBe("31%");
  });
});

describe("formatDate", () => {
  it("naptári nap: HU és EN", () => {
    expect(norm(formatDate("2026-11-10", "hu", "Europe/Budapest"))).toBe("2026. nov. 10.");
    expect(norm(formatDate("2026-11-10", "en", "Europe/Budapest"))).toBe("10 Nov 2026");
  });
  it("naptári nap nem csúszik az időzónától", () => {
    for (const tz of ["Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
      expect(norm(formatDate("2026-11-10", "en", tz))).toBe("10 Nov 2026");
    }
  });
  it("időbélyeg a megadott időzónában formázódik", () => {
    // 23:30 UTC = másnap 00:30 Budapesten (téli idő)
    expect(norm(formatDate("2026-10-31T23:30:00Z", "en", "Europe/Budapest"))).toBe("1 Nov 2026");
    expect(norm(formatDate("2026-10-31T23:30:00Z", "en", "UTC"))).toBe("31 Oct 2026");
  });
});

describe("todayIn", () => {
  const now = new Date("2026-10-13T22:30:00Z");
  it("a profil időzónája szerinti nap", () => {
    expect(todayIn("Europe/Budapest", now)).toBe("2026-10-14"); // CEST = UTC+2
    expect(todayIn("UTC", now)).toBe("2026-10-13");
    expect(todayIn("America/New_York", now)).toBe("2026-10-13");
  });
});

describe("formatRelativeDay", () => {
  const today = "2026-10-13";
  it("ma / holnap / tegnap / N nap", () => {
    expect(formatRelativeDay("2026-10-13", today, "hu")).toBe("ma");
    expect(formatRelativeDay("2026-10-14", today, "hu")).toBe("holnap");
    expect(formatRelativeDay("2026-10-12", today, "hu")).toBe("tegnap");
    expect(formatRelativeDay("2026-10-16", today, "hu")).toBe("3 nap múlva");
    expect(formatRelativeDay("2026-10-13", today, "en")).toBe("today");
    expect(formatRelativeDay("2026-10-14", today, "en")).toBe("tomorrow");
    expect(formatRelativeDay("2026-10-16", today, "en")).toBe("in 3 days");
  });
  it("óraátállítás napján sem csúszik (naptári napok különbsége)", () => {
    expect(formatRelativeDay("2026-10-26", "2026-10-25", "en")).toBe("tomorrow");
  });
});

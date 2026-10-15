import { describe, expect, it } from "vitest";
import { describeNotification } from "@/lib/notification-text";

const row = (kind: string, payload: unknown, reminder = "r1", occ: string | null = "o1") => ({ kind, payload, reminder_id: reminder, occurrence_id: occ });
const P = { name: "Netflix", amount: 2300, currency: "HUF", due_date: "2026-11-10" };

describe("describeNotification (§12.3)", () => {
  it("emlékeztető: aznap / holnap / N nap, a mély link relatív", () => {
    expect(describeNotification(row("reminder", { ...P, offset: 0 })).key).toBe("reminderToday");
    expect(describeNotification(row("reminder", { ...P, offset: 1 })).key).toBe("reminderTomorrow");
    const days = describeNotification(row("reminder", { ...P, offset: 3 }));
    expect(days).toMatchObject({ key: "reminderDays", values: { n: 3, name: "Netflix", amount: 2300, date: "2026-11-10" }, url: "/reminders/r1?occ=o1" });
  });
  it("halasztott emlékeztető külön szöveg", () => {
    expect(describeNotification(row("reminder", { ...P, offset: null, snoozed: true })).key).toBe("reminderSnoozed");
  });
  it("lejárt, próbaidő, teszt", () => {
    expect(describeNotification(row("overdue", { ...P, k: 1 })).key).toBe("overdue");
    expect(describeNotification(row("trial_end", { name: "HBO", trial_ends_on: "2026-11-01" }))).toMatchObject({ key: "trialEnd", values: { name: "HBO" } });
    expect(describeNotification(row("test", {}, "", null))).toMatchObject({ key: "test", url: "/profile?section=notifications" });
  });
  it("heti digest: darab, összeg, az első tételek nevei; a naptárra mutat", () => {
    const v = describeNotification(row("digest", { count: 4, total: 12000, base_currency: "HUF", items: [{ name: "A" }, { name: "B" }, { x: 1 }] }, "", null));
    expect(v).toMatchObject({ key: "digest", values: { count: 4, total: 12000, currency: "HUF", names: "A, B" }, url: "/calendar" });
  });
  it("ismeretlen fajta és sérült payload nem dob hibát", () => {
    expect(describeNotification(row("valami", null)).key).toBe("generic");
    expect(describeNotification(row("reminder", "szöveg")).values).toEqual({ name: undefined, amount: undefined, currency: undefined, date: undefined, n: 0 });
    expect(describeNotification(row("reminder", { name: 5, amount: "x", offset: "1" })).values.name).toBeUndefined();
  });
  it("a payload url-je sosem kerül a mély linkbe (nincs open redirect)", () => {
    expect(describeNotification(row("reminder", { ...P, offset: 1, url: "https://evil.example" })).url).toBe("/reminders/r1?occ=o1");
  });
  it("reminder nélküli emlékeztető-sor a főoldalra mutat", () => {
    expect(describeNotification(row("reminder", { ...P, offset: 1 }, "" as unknown as string, null)).url).toBe("/dashboard");
  });

  describe("keret-riasztás (A-45) és bank-lejárat (advanced.md §6)", () => {
    const CAT = "0b3f8a55-62c1-4a6e-9c1b-1f2d3e4a5b6c";
    const budget = (level: string, over: Record<string, unknown> = {}) =>
      row("budget", { level, category_id: CAT, category_name_hu: "Étterem", category_name_en: "Restaurants", month: "2026-10", spent: 16000, limit: 15000, pct: 106.6, currency: "HUF", ...over }, "", null);

    it("túllépés: a kategórianév a nyelv szerint, az összegek a payloadból, a link a kategória-részletre mutat", () => {
      expect(describeNotification(budget("over"), "hu")).toEqual({
        key: "budgetOver",
        values: { name: "Étterem", amount: 16000, total: 15000, currency: "HUF", pct: 107 },
        url: `/budgets/${CAT}`,
      });
      expect(describeNotification(budget("over"), "en").values.name).toBe("Restaurants");
    });

    it("közel a kerethez: watch → budgetWatch, a százalék kerekített", () => {
      expect(describeNotification(budget("watch", { pct: 87.4 })).key).toBe("budgetWatch");
      expect(describeNotification(budget("watch", { pct: 87.4 })).values.pct).toBe(87);
    });

    it("hiányzó nyelvi név a másikra esik vissza; hibás payload nem dob, és a link a /budgets-re esik", () => {
      expect(describeNotification(budget("over", { category_name_en: undefined }), "en").values.name).toBe("Étterem");
      const bad = describeNotification(row("budget", null, "", null));
      expect(bad).toMatchObject({ key: "budgetWatch", url: "/budgets" });
      expect(bad.values.name).toBe("");
    });

    it("a mély link csak UUID kategóriából épül (nincs útvonal-injektálás a payloadból)", () => {
      for (const id of ["../../admin", `${CAT}/../x`, "https://evil.example", "x"]) {
        expect(describeNotification(budget("over", { category_id: id })).url, id).toBe("/budgets");
      }
    });

    it("bank-lejárat: bank neve + hátralévő nap, a link a /bank (a payloadból idegen URL nem jön át)", () => {
      expect(describeNotification(row("bank_consent", { bank: "Revolut", days_left: 2, connection: "c1", url: "https://evil.example" }, "", null))).toEqual({
        key: "bankConsent",
        values: { name: "Revolut", n: 2 },
        url: "/bank",
      });
      expect(describeNotification(row("bank_consent", null, "", null)).values).toEqual({ name: "", n: 0 });
    });
  });
});

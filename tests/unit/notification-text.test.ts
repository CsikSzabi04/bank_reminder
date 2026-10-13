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
});

import { describe, expect, it } from "vitest";
import { parseAmount, readReminderForm, reminderSchema, toRecurrence } from "@/lib/schemas/reminder";

const base = {
  name: "Netflix",
  amount: "2 300",
  currency: "HUF",
  recurrence: "month",
  recurEvery: "1",
  startDate: "2026-11-10",
  remindTime: "09:00",
  offsets: ["1"],
  usageTags: [],
};
const parse = (over: Record<string, unknown> = {}) => reminderSchema.safeParse({ ...base, ...over });
const errors = (r: ReturnType<typeof parse>) => (r.success ? [] : r.error.issues.map((i) => `${i.path.join(".")}:${i.message}`));

describe("parseAmount (H9: csak értelmez, nem számol)", () => {
  it("magyar és angol formátum, szóközök", () => {
    expect(parseAmount("2300")).toBe(2300);
    expect(parseAmount("2 300")).toBe(2300);
    expect(parseAmount("2 300,50")).toBe(2300.5);
    expect(parseAmount("12.5")).toBe(12.5);
    expect(parseAmount("0")).toBe(0);
    expect(parseAmount("999999999999.99")).toBe(999_999_999_999.99);
  });
  it("érvénytelen bemenet → null", () => {
    for (const bad of ["", "abc", "1,234,56", "12.345", "-5", "1e5", "1 2 .3.4", "999999999999.999", "1000000000000"]) {
      expect(parseAmount(bad), bad).toBeNull();
    }
  });
});

describe("reminderSchema", () => {
  it("érvényes alap-adat átmegy; az összeg számmá alakul", () => {
    const r = parse();
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.amount).toBe(2300);
      expect(r.data.offsets).toEqual([1]);
      expect(r.data.isSubscription).toBe(false);
    }
  });

  it("negatív összeg, érvénytelen összeg, üres név, 80 karakternél hosszabb név (§14.6 tiltások)", () => {
    expect(errors(parse({ amount: "-100" }))).toContain("amount:amountNegative");
    expect(errors(parse({ amount: "sok" }))).toContain("amount:amountInvalid");
    expect(errors(parse({ name: "  " }))).toContain("name:required");
    expect(errors(parse({ name: "x".repeat(81) }))).toContain("name:tooLong");
  });

  it("legfeljebb 5 emlékeztetési időpont, mind 0–30 nap", () => {
    expect(errors(parse({ offsets: ["0", "1", "2", "3", "7", "14"] }))).toContain("offsets:tooManyOffsets");
    expect(errors(parse({ offsets: ["31"] }))).toContain("offsets.0:offsetRange");
    expect(errors(parse({ offsets: ["-1"] }))).toContain("offsets.0:offsetRange");
    expect(parse({ offsets: ["0", "1", "2", "3", "7"] }).success).toBe(true);
    expect(parse({ offsets: [] }).success).toBe(true); // nincs külön értesítés: csak az in-app
  });

  it("dátumok: érvénytelen dátum, a lezárás nem lehet a kezdés előtt", () => {
    expect(errors(parse({ startDate: "2026-13-40" }))).toContain("startDate:invalidDate");
    expect(errors(parse({ startDate: "tegnap" }))).toContain("startDate:invalidDate");
    expect(errors(parse({ endDate: "2026-11-09" }))).toContain("endDate:endBeforeStart");
    expect(parse({ endDate: "2026-11-10" }).success).toBe(true);
  });

  it("idő, link, megjegyzés", () => {
    expect(errors(parse({ remindTime: "25:00" }))).toContain("remindTime:invalidTime");
    expect(errors(parse({ url: "javascript:alert(1)" }))).toContain("url:urlInvalid");
    expect(errors(parse({ url: "ftp://x.hu" }))).toContain("url:urlInvalid");
    expect(parse({ url: "https://netflix.com" }).success).toBe(true);
    expect(errors(parse({ note: "x".repeat(501) }))).toContain("note:noteTooLong");
  });

  it("üres választható mezők (kategória, katalógus, dátum) nem hibák", () => {
    expect(parse({ categoryId: "", serviceSlug: "", endDate: "", trialEndsOn: "", note: "", url: "" }).success).toBe(true);
    expect(errors(parse({ categoryId: "nem-uuid" }))).toContain("categoryId:invalid");
  });

  it("ismeretlen pénznem és használat-címke elutasítva", () => {
    expect(errors(parse({ currency: "XXX" }))).toContain("currency:invalidCurrency");
    expect(errors(parse({ usageTags: ["movies", "hack"] })).some((e) => e.startsWith("usageTags"))).toBe(true);
  });

  it("egyéni ismétlődésnél kell egység; az ismétlődési szám 1–60", () => {
    expect(errors(parse({ recurrence: "custom" }))).toContain("recurUnit:invalid");
    expect(parse({ recurrence: "custom", recurUnit: "week", recurEvery: "2" }).success).toBe(true);
    expect(errors(parse({ recurEvery: "0" }))).toContain("recurEvery:invalid");
    expect(errors(parse({ recurEvery: "61" }))).toContain("recurEvery:invalid");
  });

  it("jelölőnégyzetek: on → igaz, hiányzó → hamis", () => {
    const r = parse({ isSubscription: "on", monthEnd: "on", remindEnabled: "on", autoPaid: "on" });
    expect(r.success && [r.data.isSubscription, r.data.monthEnd, r.data.remindEnabled, r.data.autoPaid]).toEqual([true, true, true, true]);
    const off = parse();
    expect(off.success && off.data.remindEnabled).toBe(false);
  });
});

describe("toRecurrence (§8: once = unit null, every 1)", () => {
  it("módok → (unit, every)", () => {
    expect(toRecurrence({ recurrence: "once", recurEvery: 5, recurUnit: "day" })).toEqual({ recur_unit: null, recur_every: 1 });
    expect(toRecurrence({ recurrence: "month", recurEvery: 9, recurUnit: undefined })).toEqual({ recur_unit: "month", recur_every: 1 });
    expect(toRecurrence({ recurrence: "week", recurEvery: 1, recurUnit: undefined })).toEqual({ recur_unit: "week", recur_every: 1 });
    expect(toRecurrence({ recurrence: "custom", recurEvery: 3, recurUnit: "month" })).toEqual({ recur_unit: "month", recur_every: 3 });
  });
});

describe("readReminderForm", () => {
  it("a többszörös mezők tömbbé válnak", () => {
    const fd = new FormData();
    fd.set("name", "X");
    fd.append("offset", "1");
    fd.append("offset", "3");
    fd.append("usageTag", "movies");
    const out = readReminderForm(fd);
    expect(out.offsets).toEqual(["1", "3"]);
    expect(out.usageTags).toEqual(["movies"]);
    expect(out.name).toBe("X");
  });
});

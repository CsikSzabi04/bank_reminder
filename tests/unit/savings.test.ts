import { describe, expect, it } from "vitest";
import { budgetSchema, expenseSchema } from "@/lib/schemas/budget";
import { contributionSchema, goalSchema } from "@/lib/schemas/savings";
import { PRESET_DEFAULTS, PRESETS, resolvePreset } from "@/lib/savings/icons";

const id = "11111111-1111-4111-8111-111111111111";

describe("resolvePreset", () => {
  it("ismert érték marad, minden más → custom", () => {
    for (const p of PRESETS) expect(resolvePreset(p)).toBe(p);
    expect(resolvePreset(undefined)).toBe("custom");
    expect(resolvePreset("evil")).toBe("custom");
    expect(resolvePreset("")).toBe("custom");
  });
  it("minden előkészített célnak van ikonja és színe (1–7)", () => {
    for (const p of PRESETS) {
      expect(PRESET_DEFAULTS[p].icon).toBeTruthy();
      expect(PRESET_DEFAULTS[p].colorSlot).toBeGreaterThanOrEqual(1);
      expect(PRESET_DEFAULTS[p].colorSlot).toBeLessThanOrEqual(7);
    }
  });
});

describe("goalSchema", () => {
  const ok = { name: "Nyaralás", target: "300 000", targetDate: "", icon: "plane", colorSlot: "3" };
  it("érvényes adat: az összeg szám, az üres dátum elmarad", () => {
    const r = goalSchema.parse(ok);
    expect(r.target).toBe(300000);
    expect(r.targetDate).toBeUndefined();
    expect(r.colorSlot).toBe(3);
  });
  it.each([
    ["üres név", { ...ok, name: "  " }, "name", "required"],
    ["túl hosszú név", { ...ok, name: "x".repeat(61) }, "name", "tooLong"],
    ["érvénytelen összeg", { ...ok, target: "abc" }, "target", "amountInvalid"],
    ["negatív összeg", { ...ok, target: "-5" }, "target", "amountNegative"],
    ["ismeretlen ikon", { ...ok, icon: "rocket" }, "icon", "invalid"],
    ["a 8-as (piros) szín nincs kiosztva", { ...ok, colorSlot: "8" }, "colorSlot", "invalid"],
    ["rossz dátum", { ...ok, targetDate: "2026-13-40" }, "targetDate", "invalidDate"],
  ])("%s → hibakód", (_n, input, field, code) => {
    const r = goalSchema.safeParse(input);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues.find((i) => i.path[0] === field)?.message).toBe(code);
  });
});

describe("contributionSchema", () => {
  const ok = { amount: "12 500,50", direction: "add", contributedOn: "2026-10-13", note: "" };
  it("a vesszős tizedes értelmezett, az irány kötelező", () => {
    expect(contributionSchema.parse(ok).amount).toBe(12500.5);
    expect(contributionSchema.safeParse({ ...ok, direction: "both" }).success).toBe(false);
    expect(contributionSchema.safeParse({ ...ok, note: "x".repeat(201) }).success).toBe(false);
  });
});

describe("budgetSchema / expenseSchema", () => {
  it("keret: uuid + összeg", () => {
    expect(budgetSchema.parse({ categoryId: id, limit: "50 000" }).limit).toBe(50000);
    expect(budgetSchema.safeParse({ categoryId: "nem-uuid", limit: "1" }).success).toBe(false);
    expect(budgetSchema.safeParse({ categoryId: id, limit: "" }).success).toBe(false);
  });
  it("kiadás: kategória elhagyható, dátum kötelező", () => {
    const r = expenseSchema.parse({ amount: "990", categoryId: "", spentOn: "2026-10-13", note: "" });
    expect(r.categoryId).toBeUndefined();
    expect(r.note).toBeUndefined();
    expect(expenseSchema.safeParse({ amount: "990", spentOn: "" }).success).toBe(false);
    expect(expenseSchema.safeParse({ amount: "990", spentOn: "2026-10-13", note: "x".repeat(201) }).success).toBe(false);
  });
});

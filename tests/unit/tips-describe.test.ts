import { describe, expect, it } from "vitest";
import { formatMoney } from "@/lib/format";
import { TIP_CODES, isTipCode, tipVars, type TipContext } from "@/lib/tips/describe";

const huf = (n: number) => formatMoney(n, "HUF", "hu");

const ctx: TipContext = {
  locale: "hu",
  currency: "HUF",
  categoryName: (id) => (id === "c1" ? "Ruházat" : "?"),
  usageLabel: (tag) => `[${tag}]`,
  groupLabel: (g) => `<${g}>`,
};

describe("isTipCode", () => {
  it("csak az ismert kódok", () => {
    for (const c of TIP_CODES) expect(isTipCode(c)).toBe(true);
    expect(isTipCode("round_up_idea")).toBe(false);
    expect(isTipCode("")).toBe(false);
  });
});

describe("tipVars", () => {
  it("pénz, százalék, dátum, lista a nyelv szerint formázva", () => {
    const v = tipVars("trial_ending", { name: "X", date: "2026-11-03", amount_after: 2990, currency: "HUF" }, ctx);
    expect(v).toEqual({ name: "X", date: expect.stringMatching(/2026/), amount: huf(2990) });

    expect(tipVars("price_increase", { name: "N", old: 2000, new: 2300, pct: 15, currency: "HUF" }, ctx)).toEqual({
      name: "N",
      old: huf(2000),
      new: huf(2300),
      pct: "15%",
    });
    expect(tipVars("subs_share_high", { pct: 31.4, monthly: 38900, yearly: 466800 }, ctx)).toMatchObject({ pct: "31%", yearly: huf(466800) });
  });
  it("az átfedés-tipp csoport-felirata és neve-listája", () => {
    const v = tipVars("sub_overlap_group", { group: "video_streaming", names: ["Netflix", "HBO Max", "Prime"], monthly_total: 7800, count: 3 }, ctx);
    expect(v.group).toBe("<video_streaming>");
    expect(v.count).toBe(3);
    expect(String(v.names)).toContain("Netflix");
    expect(v.total).toBe(huf(7800));
  });
  it("a fedett előfizetés címkéi a címke-szótárból", () => {
    const v = tipVars("sub_covered_by_others", { name: "Prime", tags: ["movies", "series"], covered_by: ["Netflix"] }, ctx);
    expect(String(v.tags)).toContain("[movies]");
    expect(String(v.tags)).toContain("[series]");
    expect(v.covered).toBe("Netflix");
  });
  it("keret-tippek: a kategória neve az azonosítóból, az összegek pénzként", () => {
    expect(tipVars("budget_over_now", { category_id: "c1", over: 300, currency: "HUF" }, ctx)).toEqual({ category: "Ruházat", over: huf(300) });
    expect(tipVars("budget_forecast_over", { category_id: "c1", forecast: 45000, limit: 40000 }, ctx)).toEqual({
      category: "Ruházat",
      forecast: huf(45000),
      limit: huf(40000),
    });
  });
  it("hiányzó / rossz típusú paraméter nem dob: üres szöveg, 0", () => {
    expect(tipVars("late_payment_pattern", {}, ctx)).toEqual({ name: "", count: 0 });
    expect(tipVars("trial_ending", { name: 5, date: null, amount_after: "x" }, ctx)).toEqual({ name: "", date: "", amount: huf(0) });
    expect(tipVars("duplicate_reminder", { a: "A" }, ctx)).toEqual({ a: "A", b: "" });
  });
  it("a paraméter pénzneme felülírja az alap-pénznemet", () => {
    expect(tipVars("budget_over_now", { category_id: "c1", over: 10, currency: "EUR" }, ctx).over).toMatch(/10,00/);
  });
});

import { describe, expect, it, vi } from "vitest";
import { buildInsights } from "@/lib/analytics/insights";
import { rangeWindow, resolveRange, trendMonths } from "@/lib/analytics/range";

vi.mock("server-only", () => ({}));

describe("resolveRange", () => {
  it("ismert érték marad, minden más → month", () => {
    expect(resolveRange("12m")).toBe("12m");
    expect(resolveRange("ytd")).toBe("ytd");
    expect(resolveRange(undefined)).toBe("month");
    expect(resolveRange("evil")).toBe("month");
    expect(resolveRange("")).toBe("month");
  });
});

describe("rangeWindow", () => {
  it("a to a kiválasztott hónap utolsó napja (szökőév is)", () => {
    expect(rangeWindow("month", "2026-10-01")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(rangeWindow("month", "2028-02-01")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(rangeWindow("month", "2026-02-01").to).toBe("2026-02-28");
  });
  it("a többhónapos tartományok hónap-elejétől indulnak", () => {
    expect(rangeWindow("3m", "2026-10-01").from).toBe("2026-08-01");
    expect(rangeWindow("6m", "2026-10-01").from).toBe("2026-05-01");
    expect(rangeWindow("12m", "2026-10-01").from).toBe("2025-11-01");
    expect(rangeWindow("3m", "2026-01-01").from).toBe("2025-11-01");
  });
  it("idén: az év első napjától", () => {
    expect(rangeWindow("ytd", "2026-10-01")).toEqual({ from: "2026-01-01", to: "2026-10-31" });
  });
});

describe("trendMonths", () => {
  it("6 / 12 / idén (min. 3)", () => {
    expect(trendMonths("month", "2026-10-01")).toBe(6);
    expect(trendMonths("3m", "2026-10-01")).toBe(6);
    expect(trendMonths("6m", "2026-10-01")).toBe(6);
    expect(trendMonths("12m", "2026-10-01")).toBe(12);
    expect(trendMonths("ytd", "2026-10-01")).toBe(10);
    expect(trendMonths("ytd", "2026-01-01")).toBe(3);
  });
});

describe("buildInsights", () => {
  const base = { deltaPct: null, top: null, subsMonthly: 0, monthTotal: 0, cumulative: [] as number[] };
  it("üres bemenetre nincs meglátás", () => {
    expect(buildInsights(base)).toEqual([]);
  });
  it("változás: előjel szerinti kód, a pct tört, abszolút érték", () => {
    expect(buildInsights({ ...base, deltaPct: 8 })).toEqual([{ code: "deltaUp", pct: 0.08 }]);
    expect(buildInsights({ ...base, deltaPct: -12.5 })).toEqual([{ code: "deltaDown", pct: 0.125 }]);
    expect(buildInsights({ ...base, deltaPct: 0 })).toEqual([]);
  });
  it("legnagyobb tétel csak pozitív összeggel", () => {
    expect(buildInsights({ ...base, top: { name: "Albérlet", total: 65000 } })).toEqual([{ code: "topItem", name: "Albérlet", amount: 65000 }]);
    expect(buildInsights({ ...base, top: { name: "x", total: 0 } })).toEqual([]);
  });
  it("előfizetés-arány: tört, legfeljebb 100%, 0 osztóval nem számol", () => {
    expect(buildInsights({ ...base, subsMonthly: 30, monthTotal: 100 })).toEqual([{ code: "subsShare", pct: 0.3 }]);
    expect(buildInsights({ ...base, subsMonthly: 300, monthTotal: 100 })).toEqual([{ code: "subsShare", pct: 1 }]);
    expect(buildInsights({ ...base, subsMonthly: 30, monthTotal: 0 })).toEqual([]);
  });
  it("hónap eleji súly: a 10. nap kumulatívja / összeg ≥ 60%", () => {
    // az első 9 nap 0, a 10. naptól d10, az utolsó nap a teljes összeg
    const days = (d10: number, total: number) => Array.from({ length: 30 }, (_, i) => (i < 9 ? 0 : i < 29 ? d10 : total));
    expect(buildInsights({ ...base, cumulative: days(70, 100) })).toEqual([{ code: "frontLoaded", pct: 0.7 }]);
    expect(buildInsights({ ...base, cumulative: days(60, 100) })).toEqual([{ code: "frontLoaded", pct: 0.6 }]);
    expect(buildInsights({ ...base, cumulative: days(59, 100) })).toEqual([]);
    // 10 napnál rövidebb adatból nem következtetünk
    expect(buildInsights({ ...base, cumulative: [50, 100] })).toEqual([]);
  });
});

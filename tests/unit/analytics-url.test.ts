import { describe, expect, it } from "vitest";
import { groupKeyForSlot } from "@/lib/analytics/groups";
import { analyticsHref } from "@/lib/analytics/url";

const cur = "2026-10-01";

describe("analyticsHref", () => {
  it("az alapállapot tiszta URL", () => {
    expect(analyticsHref({ month: cur, currentMonth: cur, range: "month", view: "chart" })).toBe("/analytics");
  });
  it("csak az eltérő értékek kerülnek bele", () => {
    expect(analyticsHref({ month: "2026-08-01", currentMonth: cur, range: "month", view: "chart" })).toBe("/analytics?month=2026-08");
    expect(analyticsHref({ month: cur, currentMonth: cur, range: "6m", view: "chart" })).toBe("/analytics?range=6m");
    expect(analyticsHref({ month: cur, currentMonth: cur, range: "month", view: "table" })).toBe("/analytics?view=table");
    expect(analyticsHref({ month: "2026-08-01", currentMonth: cur, range: "ytd", view: "table" })).toBe("/analytics?month=2026-08&range=ytd&view=table");
  });
});

describe("groupKeyForSlot", () => {
  it("az SQL group_key tükre; a 8-as és az ismeretlen → other", () => {
    expect([1, 2, 3, 4, 5, 6, 7, 9].map(groupKeyForSlot)).toEqual([
      "subscriptions",
      "housing",
      "telecom",
      "insurance_tax",
      "loans_fees",
      "everyday",
      "lifestyle",
      "other",
    ]);
    expect(groupKeyForSlot(8)).toBe("other");
    expect(groupKeyForSlot(0)).toBe("other");
    expect(groupKeyForSlot(99)).toBe("other");
  });
});

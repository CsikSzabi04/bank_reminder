import { describe, expect, it } from "vitest";
import { monthGrid } from "@/lib/calendar";

describe("monthGrid (hétfő az első nap)", () => {
  it("2026. október: csütörtökön kezdődik, 5 hét, minden hét 7 cella", () => {
    const g = monthGrid("2026-10-01");
    expect(g).toHaveLength(5);
    for (const w of g) expect(w).toHaveLength(7);
    expect(g[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(g[4].slice(-2)).toEqual(["2026-10-31", null]); // október 31. szombat
  });
  it("hétfőn kezdődő hónap nem kap kezdő-kitöltést (2026. június)", () => {
    expect(monthGrid("2026-06-01")[0][0]).toBe("2026-06-01");
  });
  it("vasárnapon kezdődő hónap 6 kitöltött cellát kap (2026. február)", () => {
    const g = monthGrid("2026-02-01");
    expect(g[0].filter((c) => c === null)).toHaveLength(6);
    expect(g.flat().filter(Boolean)).toHaveLength(28);
  });
  it("szökőév és 6 hetes hónap: minden nap pontosan egyszer szerepel", () => {
    const g = monthGrid("2028-02-01").flat().filter(Boolean);
    expect(g).toHaveLength(29);
    expect(new Set(g).size).toBe(29);
    expect(monthGrid("2026-08-01")).toHaveLength(6); // szombaton kezdődik, 31 nap
  });
});

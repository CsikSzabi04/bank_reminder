import { describe, expect, it } from "vitest";
import { layoutCumulative } from "@/lib/charts/cumulative";
import { layoutStacked } from "@/lib/charts/stacked";

const margin = { top: 10, right: 10, bottom: 20, left: 40 };

describe("layoutStacked", () => {
  const l = layoutStacked({
    values: [
      [10, 0, 30],
      [20, 0, 0],
    ],
    width: 340,
    height: 220,
    margin,
    segGap: 2,
  });

  it("a tengely a legnagyobb halmozott összeg fölé szép értékig tart", () => {
    // max(10+20, 0, 30) = 30 → 50
    expect(l.yMax).toBe(50);
    expect(l.ticks.at(0)?.y).toBe(l.baseline);
    expect(l.ticks.at(-1)?.y).toBe(margin.top);
  });
  it("a nulla értékű szegmens nem rajzolódik", () => {
    expect(l.rects.filter((r) => r.cat === 1)).toHaveLength(0);
    expect(l.rects).toHaveLength(3);
  });
  it("a szegmensek egymásra halmozódnak; a felső kap 2 px rést, az alsó nem", () => {
    const [a, b] = l.rects.filter((r) => r.cat === 0);
    expect(a.y + a.h).toBeCloseTo(l.baseline, 6);
    expect(b.y + b.h + 2).toBeCloseTo(a.y, 6);
    expect(a.top).toBe(false);
    expect(b.top).toBe(true);
  });
  it("az oszlopok a sávok közepén, a rajzterületen belül vannak", () => {
    for (const r of l.rects) {
      expect(r.x).toBeGreaterThanOrEqual(margin.left);
      expect(r.x + r.w).toBeLessThanOrEqual(340 - margin.right);
    }
    expect(l.xCenter(0)).toBeCloseTo(margin.left + l.band / 2, 6);
  });
  it("üres adatnál nincs oszlop és nincs NaN", () => {
    const e = layoutStacked({ values: [], width: 340, height: 220, margin });
    expect(e.rects).toEqual([]);
    expect(Number.isNaN(e.band)).toBe(false);
  });
});

describe("layoutCumulative", () => {
  const l = layoutCumulative({ days: 4, current: [0, 10, 10, 40], previous: [5, 5, null, null], width: 340, height: 220, margin });
  it("az útvonal a napok számával egyezik, a terület lezárt", () => {
    expect(l.currentPath.match(/[ML]/g)).toHaveLength(4);
    expect(l.areaPath.endsWith("Z")).toBe(true);
    expect(l.last?.[0]).toBeCloseTo(340 - margin.right, 6);
  });
  it("az előző hónap null értékeinél megszakad / rövidebb", () => {
    expect(l.previousPaths).toHaveLength(1);
    expect(l.previousPaths[0].match(/[ML]/g)).toHaveLength(2);
  });
  it("egyetlen pontból álló szakasz nem vonal", () => {
    const one = layoutCumulative({ days: 3, current: [1, 2, 3], previous: [1, null, 2], width: 340, height: 220, margin });
    expect(one.previousPaths).toEqual([]);
  });
  it("üres adat", () => {
    const e = layoutCumulative({ days: 0, current: [], previous: [], width: 340, height: 220, margin });
    expect(e.currentPath).toBe("");
    expect(e.areaPath).toBe("");
    expect(e.last).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { denseDays, linePath, linear, niceMax, ticks, topRoundedRect } from "@/lib/charts/axes";

describe("niceMax", () => {
  it.each([
    [0, 1],
    [-5, 1],
    [Number.NaN, 1],
    [1, 1],
    [1.01, 2],
    [2.3, 2.5],
    [2.51, 5],
    [7, 10],
    [42_000, 50_000],
    [100_000, 100_000],
    [100_001, 200_000],
    [0.07, 0.1],
  ])("%s → %s", (input, expected) => {
    expect(niceMax(input)).toBeCloseTo(expected, 9);
  });
});

describe("ticks", () => {
  it("0-tól niceMax-ig egyenletes osztás", () => {
    expect(ticks(42_000, 4)).toEqual([0, 12_500, 25_000, 37_500, 50_000]);
  });
  it("üres adatnál is érvényes tengely", () => {
    expect(ticks(0, 2)).toEqual([0, 0.5, 1]);
  });
});

describe("linear", () => {
  it("leképez és megfordít (SVG y)", () => {
    const y = linear(0, 100, 200, 0);
    expect(y(0)).toBe(200);
    expect(y(100)).toBe(0);
    expect(y(25)).toBe(150);
  });
  it("elfajult tartomány: közép, nem NaN", () => {
    expect(linear(5, 5, 0, 10)(5)).toBe(5);
  });
});

describe("topRoundedRect / linePath", () => {
  it("a sugár nem nagyobb a fél szélességnél és a magasságnál", () => {
    expect(topRoundedRect(0, 0, 10, 2, 8)).toBe("M0 2V2Q0 0 2 0H8Q10 0 10 2V2Z");
    expect(topRoundedRect(0, 0, 10, 100, 8)).toBe("M0 100V5Q0 0 5 0H5Q10 0 10 5V100Z");
  });
  it("vonal M/L", () => {
    expect(
      linePath([
        [0, 1.25],
        [2, 3],
      ]),
    ).toBe("M0 1.25L2 3");
    expect(linePath([])).toBe("");
  });
});

describe("denseDays", () => {
  it("a legsűrűbb 3 nap ≥ 40% → jelölt, a nullás nap nem", () => {
    const totals = [0, 0, 100, 0, 100, 0, 10, 10, 10, 10];
    expect([...denseDays(totals)].sort()).toEqual([2, 4]);
  });
  it("40% alatt, üres vagy rövid adatnál nincs", () => {
    expect(denseDays([10, 10, 10, 10, 10, 10, 10, 10]).size).toBe(0);
    expect(denseDays([0, 0, 0, 0]).size).toBe(0);
    expect(denseDays([100, 100]).size).toBe(0);
  });
  it("pontosan a küszöbön jelöl", () => {
    // a legsűrűbb 3 nap: 20 + 20 + 20 = 60 / 100 → jelölt; a küszöb alatti változat: 30 / 100
    expect(denseDays([20, 10, 10, 20, 20, 20]).size).toBe(3);
    expect(denseDays([10, 10, 10, 10, 10, 10, 10, 10, 10, 10]).size).toBe(0);
    expect(denseDays([10, 10, 10, 10, 10, 10, 10, 10, 10, 10], 0.3).size).toBe(3);
  });
});

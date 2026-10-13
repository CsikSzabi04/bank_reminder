import { describe, expect, it } from "vitest";
import { sumMoney } from "@/lib/money";

describe("sumMoney", () => {
  it("nincs lebegőpontos sodródás", () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([1234.56, 0.01, 99.99])).toBe(1334.56);
  });
  it("üres lista és negatív érték", () => {
    expect(sumMoney([])).toBe(0);
    expect(sumMoney([100, -30.5])).toBe(69.5);
  });
  it("nagy forintösszegek pontosak", () => {
    expect(sumMoney([999_999_999.99, 0.01])).toBe(1_000_000_000);
  });
});

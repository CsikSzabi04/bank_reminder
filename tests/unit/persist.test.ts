import { describe, expect, it } from "vitest";
import { applyPersistence, FOUR_HUNDRED_DAYS } from "@/lib/auth/persist";

const base = { path: "/", sameSite: "lax" as const };

describe("applyPersistence (§10.3)", () => {
  it("maradjak = igen: tartós süti (alap 400 nap, meglévő maxAge megmarad)", () => {
    expect(applyPersistence({ ...base }, true).maxAge).toBe(FOUR_HUNDRED_DAYS);
    expect(applyPersistence({ ...base, maxAge: 100 }, true).maxAge).toBe(100);
  });

  it("maradjak = nem: session-süti (nincs maxAge/expires), a többi opció megmarad", () => {
    const out = applyPersistence({ ...base, maxAge: 999, expires: new Date() }, false);
    expect(out).not.toHaveProperty("maxAge");
    expect(out).not.toHaveProperty("expires");
    expect(out).toMatchObject(base);
  });

  it("törlés (maxAge 0) mindkét esetben érintetlen", () => {
    for (const remember of [true, false]) {
      expect(applyPersistence({ ...base, maxAge: 0 }, remember)).toEqual({ ...base, maxAge: 0 });
    }
  });

  it("nem módosítja a bemeneti objektumot", () => {
    const input = { ...base, maxAge: 5 };
    applyPersistence(input, false);
    expect(input.maxAge).toBe(5);
  });
});

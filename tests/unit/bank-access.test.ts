import { describe, expect, it } from "vitest";
import { interpretBankAccess } from "@/lib/bank/access";
import { BANK_SECTIONS, defaultBankSection, isBankSection } from "@/lib/bank/sections";

describe("interpretBankAccess (advanced.md §2.1)", () => {
  it("csak a pontos `true` ad Enable-jogosultságot", () => {
    expect(interpretBankAccess({ data: { bank_sync_allowed: true }, error: null })).toEqual({ syncAllowed: true });
    for (const value of [false, null, undefined, "true", 1, "yes"]) {
      expect(interpretBankAccess({ data: { bank_sync_allowed: value }, error: null })).toEqual({ syncAllowed: false });
    }
    expect(interpretBankAccess({ data: null, error: null })).toEqual({ syncAllowed: false });
  });

  it("hiányzó oszlop (az A-41 még nincs fent) → nincs jogosultság, nem hiba", () => {
    expect(interpretBankAccess({ data: null, error: { code: "42703" } })).toEqual({ syncAllowed: false });
    expect(interpretBankAccess({ data: null, error: { code: "PGRST204" } })).toEqual({ syncAllowed: false });
  });

  it("bármi más hiba továbbdobódik (az error boundary kezeli), és nem enged jogosultságot", () => {
    expect(() => interpretBankAccess({ data: null, error: { code: "PGRST301", message: "JWT expired" } })).toThrow();
    expect(() => interpretBankAccess({ data: null, error: { message: "network" } })).toThrow(/unknown/);
  });

  it("a hibaüzenet nem szivárogtat adatot (csak a kód)", () => {
    expect(() => interpretBankAccess({ data: null, error: { code: "XX000", message: "secret-detail" } })).toThrow(
      "bank_access_query_failed:XX000",
    );
  });
});

describe("bank-szakaszok", () => {
  it("3 szakasz, ismeretlen érték nem szakasz", () => {
    expect(BANK_SECTIONS).toEqual(["overview", "android", "rules"]);
    expect(isBankSection("android")).toBe(true);
    for (const bad of [undefined, "", "Android", "profile", "overview ", "__proto__"]) {
      expect(isBankSection(bad)).toBe(false);
    }
  });

  it("alapértelmezett szakasz: jogosultnak az összekötés, másnak az Android", () => {
    expect(defaultBankSection(true)).toBe("overview");
    expect(defaultBankSection(false)).toBe("android");
  });
});

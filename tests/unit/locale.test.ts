import { describe, expect, it } from "vitest";
import { resolveLocale } from "@/lib/i18n/config";

describe("resolveLocale", () => {
  it("sorrend: profil → süti → Accept-Language → hu", () => {
    expect(resolveLocale({ profile: "en", cookie: "hu", acceptLanguage: "hu" })).toBe("en");
    expect(resolveLocale({ cookie: "en", acceptLanguage: "hu" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "en-US,en;q=0.9,hu;q=0.8" })).toBe("en");
    expect(resolveLocale({})).toBe("hu");
  });
  it("q-érték szerint választ, ismeretlen nyelvet átugrik", () => {
    expect(resolveLocale({ acceptLanguage: "de,hu;q=0.8,en;q=0.9" })).toBe("en");
    expect(resolveLocale({ acceptLanguage: "de,fr;q=0.8" })).toBe("hu");
  });
  it("érvénytelen süti/profil értéket eldob", () => {
    expect(resolveLocale({ profile: "xx", cookie: "yy", acceptLanguage: "en" })).toBe("en");
  });
});

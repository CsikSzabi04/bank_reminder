import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/auth/safe-next";

describe("safeNext (§10.7)", () => {
  it("támadó bemenetek → fallback", () => {
    const attacks = [
      "//evil.com",
      "/\\evil.com",
      "/\\/evil.com",
      "https://evil.com",
      "http://evil.com/dashboard",
      "javascript:alert(1)",
      "data:text/html,x",
      "evil.com",
      "///evil.com",
      "",
      null,
      undefined,
    ];
    for (const a of attacks) expect(safeNext(a)).toBe("/dashboard");
  });

  // Az URL-parser kitörli a tab/újsor karaktert → "//evil.com" lenne belőle.
  // Ezeket az első szűrők (startsWith) nem fogják meg, csak az origin-ellenőrzés.
  it("vezérlőkaraktert rejtő támadás → fallback", () => {
    for (const a of ["/\t/evil.com", "/\n/evil.com", "/\r/evil.com"]) {
      expect(safeNext(a)).toBe("/dashboard");
    }
  });

  it("saját útvonal (query-vel) átmegy", () => {
    expect(safeNext("/reminders/abc?occ=1")).toBe("/reminders/abc?occ=1");
    expect(safeNext("/dashboard")).toBe("/dashboard");
  });

  it("egyéni fallback", () => {
    expect(safeNext("//evil.com", "/login")).toBe("/login");
  });
});

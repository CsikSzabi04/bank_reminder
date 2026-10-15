import { describe, expect, it } from "vitest";
import { externalUrlHost, safeExternalUrl } from "@/lib/safe-url";

describe("safeExternalUrl — csak http/https, megtévesztés nélkül", () => {
  it("érvényes http(s) hivatkozás normalizáltan visszajön", () => {
    expect(safeExternalUrl("https://claude.ai/upgrade")).toBe("https://claude.ai/upgrade");
    expect(safeExternalUrl("  http://example.com/a?b=1#c  ")).toBe("http://example.com/a?b=1#c");
    expect(safeExternalUrl("HTTPS://Example.COM")).toBe("https://example.com/");
  });

  it("veszélyes vagy értelmetlen sémák/alakok elutasítva", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JaVaScRiPt:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "file:///etc/passwd",
      "ftp://example.com",
      "vbscript:msgbox(1)",
      "//evil.example",
      "/relativ/ut",
      "claude.ai",
      "https://",
      "https://exa mple.com",
      "https://a.example/ b",
      "",
      "   ",
    ]) {
      expect(safeExternalUrl(bad), bad).toBeNull();
    }
  });

  it("felhasználónév/jelszó az URL-ben (megtévesztő: https://bank.hu@evil.example) elutasítva", () => {
    expect(safeExternalUrl("https://bank.hu@evil.example/login")).toBeNull();
    expect(safeExternalUrl("https://user:pass@example.com")).toBeNull();
  });

  it("nem string és túl hosszú érték elutasítva", () => {
    for (const bad of [null, undefined, 5 as unknown as string, {} as unknown as string]) expect(safeExternalUrl(bad)).toBeNull();
    expect(safeExternalUrl(`https://example.com/${"a".repeat(2000)}`)).toBeNull();
  });

  it("externalUrlHost: a gazdagép www nélkül; érvénytelenre null", () => {
    expect(externalUrlHost("https://www.claude.ai/x")).toBe("claude.ai");
    expect(externalUrlHost("javascript:alert(1)")).toBeNull();
    expect(externalUrlHost(null)).toBeNull();
  });
});

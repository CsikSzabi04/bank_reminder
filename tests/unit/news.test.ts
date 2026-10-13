import { describe, expect, it, vi } from "vitest";
import { formatAge } from "@/lib/format";
import { safeImageUrl } from "@/lib/news/image";
import { NEWS_TOPICS, resolveTopic, safeExternalUrl } from "@/lib/news/queries";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({}) }));

const now = new Date("2026-10-13T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

describe("formatAge", () => {
  it("percek, órák, napok — a hírek életkora magyarul", () => {
    expect(formatAge(ago(5 * 60_000), now, "hu")).toBe("5 perccel ezelőtt");
    expect(formatAge(ago(2 * 3_600_000), now, "hu")).toBe("2 órával ezelőtt");
    expect(formatAge(ago(86_400_000), now, "hu")).toBe("tegnap");
    expect(formatAge(ago(5 * 86_400_000), now, "hu")).toBe("5 nappal ezelőtt");
  });
  it("angolul is", () => {
    expect(formatAge(ago(2 * 3_600_000), now, "en")).toBe("2 hours ago");
    expect(formatAge(ago(86_400_000), now, "en")).toBe("yesterday");
  });
  it("a határok: 59 perc → perc, 60 perc → óra, 23 óra → óra, 24 óra → nap", () => {
    expect(formatAge(ago(59 * 60_000), now, "en")).toMatch(/minutes/);
    expect(formatAge(ago(60 * 60_000), now, "en")).toMatch(/hour/);
    expect(formatAge(ago(23 * 3_600_000), now, "en")).toMatch(/hours/);
    expect(formatAge(ago(24 * 3_600_000), now, "en")).toBe("yesterday");
  });
  it("néhány másodperc → „most”, akár kissé jövőbeli óraeltérésnél is", () => {
    expect(formatAge(ago(10_000), now, "en")).toBe("now");
    expect(formatAge(ago(-10_000), now, "en")).toBe("now");
  });
});

describe("safeImageUrl / safeExternalUrl", () => {
  it("csak https", () => {
    expect(safeImageUrl("https://cdn.example.hu/a.jpg")).toBe("https://cdn.example.hu/a.jpg");
    for (const bad of ["http://cdn.example.hu/a.jpg", "javascript:alert(1)", "data:image/png;base64,AAAA", "//cdn.example.hu/a.jpg", "nem url", "", null, undefined]) {
      expect(safeImageUrl(bad)).toBeNull();
    }
    expect(safeExternalUrl("https://www.penzcentrum.hu/cikk?x=1")).toBe("https://www.penzcentrum.hu/cikk?x=1");
    for (const bad of ["http://example.hu", "javascript:alert(1)", "ftp://example.hu", "x"]) expect(safeExternalUrl(bad)).toBeNull();
  });
});

describe("resolveTopic", () => {
  it("ismert téma marad, minden más → nincs szűrő", () => {
    for (const t of NEWS_TOPICS) expect(resolveTopic(t)).toBe(t);
    expect(resolveTopic("general")).toBeUndefined();
    expect(resolveTopic("evil")).toBeUndefined();
    expect(resolveTopic(undefined)).toBeUndefined();
  });
});

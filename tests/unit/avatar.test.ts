import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  detectImageType,
  MONOGRAM_BACKGROUND_LIST,
  monogram,
  monogramColors,
} from "@/lib/avatar";

const pad = (head: number[]) => Uint8Array.from([...head, ...new Array(20).fill(0)]);

describe("detectImageType (magic byte)", () => {
  it("JPEG / PNG / WebP felismerése", () => {
    expect(detectImageType(pad([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    expect(detectImageType(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    const webp = pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
    expect(detectImageType(webp)).toBe("webp");
  });
  it("SVG, GIF, HTML, RIFF-WAVE és rövid bemenet elutasítva", () => {
    const text = (s: string) => new TextEncoder().encode(s.padEnd(20, " "));
    expect(detectImageType(text("<svg xmlns='http://www.w3.org/2000/svg'/>"))).toBeNull();
    expect(detectImageType(text("GIF89a"))).toBeNull();
    expect(detectImageType(text("<html><script>"))).toBeNull();
    expect(detectImageType(pad([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
    expect(detectImageType(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    // a JPEG-aláírás mindhárom bájtja számít (FF D8 FF)
    expect(detectImageType(pad([0xff, 0xd8, 0x00, 0xe0]))).toBeNull();
  });
});

describe("monogram", () => {
  it("kezdőbetűk", () => {
    expect(monogram("Kiss Béla")).toBe("KB");
    expect(monogram("  anna  ")).toBe("AN");
    expect(monogram("Nagy Kovács Éva")).toBe("NÉ");
    expect(monogram("")).toBe("?");
    expect(monogram(null)).toBe("?");
  });
});

describe("monogramColors", () => {
  it("determinisztikus, és a szöveg minden háttéren eléri a 3:1 kontrasztot (nagy, félkövér szöveg)", () => {
    expect(monogramColors("abc")).toEqual(monogramColors("abc"));
    for (const bg of MONOGRAM_BACKGROUND_LIST) {
      const hash = MONOGRAM_BACKGROUND_LIST.indexOf(bg);
      // a hash-ből független ellenőrzés: minden háttérre létezik elég kontrasztos szövegszín
      const best = Math.max(contrastRatio(bg, "#FFFFFF"), contrastRatio(bg, "#0F1720"));
      expect(best, `${bg}#${hash}`).toBeGreaterThanOrEqual(3);
    }
  });
  it("különböző felhasználók különböző színeket kapnak (nem minden ugyanaz)", () => {
    const colors = new Set(Array.from({ length: 30 }, (_, i) => monogramColors(`user-${i}`).background));
    expect(colors.size).toBeGreaterThan(3);
  });
});

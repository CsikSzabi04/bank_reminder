import type { Page } from "@playwright/test";

// A nézetablakon túlnyúló elemek (vízszintes görgetést okozók), a leírásukkal. A saját görgethető/vágott
// tárolóba (overflow-x ≠ visible) zárt elemek nem számítanak (pl. a vízszintes chip-sor).
export async function overflowingElements(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const out: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.right <= limit + 0.5) continue;
      let clipped = false;
      for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
        if (getComputedStyle(p).overflowX !== "visible") {
          clipped = true;
          break;
        }
      }
      if (!clipped) {
        const cls = (el.getAttribute("class") ?? "").split(/\s+/).slice(0, 4).join(".");
        out.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} (jobb szél: ${Math.round(rect.right)} > ${limit})`);
      }
    }
    return out.slice(0, 8);
  });
}

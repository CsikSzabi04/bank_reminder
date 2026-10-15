import type { Page } from "@playwright/test";

// Érintési cél-méret (§14.14: ≥ 44×44 px). A szövegbe ágyazott (inline) hivatkozások, a rejtett és a képernyőolvasó-only
// elemek mentesek; a vizuálisan rejtett rádió/jelölőnégyzetnél a körülvevő <label> a cél. Visszaadja a szabálysértőket.
export async function smallTargets(page: Page, min = 44): Promise<string[]> {
  return page.evaluate((limit) => {
    const out: string[] = [];
    const selector = 'a[href], button, select, textarea, summary, input:not([type="hidden"]), [role="switch"], [role="tab"], [role="button"], [role="link"]';
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.closest("[aria-hidden='true'], [inert]")) continue;
      const style = getComputedStyle(el);
      if (style.visibility === "hidden" || style.display === "none") continue;
      let target: HTMLElement = el;
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
        // a <label> a koppintható cél (a natív jelölő 20 px-es lehet), ha van körülvevő label
        target = (el.closest("label") as HTMLElement | null) ?? el;
      }
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // „Ugrás a tartalomra": csak fókuszra jelenik meg
      if (target.classList.contains("sr-only")) continue;
      // szövegbe ágyazott hivatkozás (inline, szöveg-szomszédokkal): mentes (WCAG 2.5.8 inline kivétel)
      if (target instanceof HTMLAnchorElement && getComputedStyle(target).display === "inline") continue;
      // a hónap-rács 7 oszlopa 360 px-en legfeljebb ~41 px széles (a magasság 48): ott a 40 px a határ (WCAG 2.5.8 AA: 24 px)
      const need = target.hasAttribute("data-dense-target") ? Math.min(limit, 40) : limit;
      if (rect.width < need - 0.5 || rect.height < need - 0.5) {
        const label = (target.getAttribute("aria-label") ?? target.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
        out.push(`${target.tagName.toLowerCase()} "${label}" ${Math.round(rect.width)}×${Math.round(rect.height)}`);
      }
    }
    return out.slice(0, 12);
  }, min);
}

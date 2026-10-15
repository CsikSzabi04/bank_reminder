import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { smallTargets } from "../e2e/support/a11y";
import { overflowingElements } from "../e2e/support/layout";

// B-29: a kijelentkezve elérhető oldalak (belépés, regisztráció, jelszó-emlékeztető, jogi oldalak, telepítés, búcsú, 404):
// 0 serious/critical axe-hiba világos/sötét módban, asztali és mobil (360 px) nézeten; mobilon cél-méret ≥ 44 px és nincs túlcsordulás
const PAGES: Array<[string, string]> = [
  ["Belépés", "/login"],
  ["Regisztráció", "/signup"],
  ["Elfelejtett jelszó", "/forgot-password"],
  ["E-mail megerősítés", "/check-email?email=teszt%40example.com"],
  ["Adatkezelés", "/privacy"],
  ["ÁSZF", "/terms"],
  ["Telepítés", "/install"],
  ["Búcsú", "/goodbye"],
  ["404", "/nincs-ilyen-oldal"],
];

const MODES = [
  { name: "asztali világos", scheme: "light", viewport: { width: 1280, height: 800 } },
  { name: "asztali sötét", scheme: "dark", viewport: { width: 1280, height: 800 } },
  { name: "mobil 360 px", scheme: "light", viewport: { width: 360, height: 740 } },
  { name: "mobil 360 px sötét", scheme: "dark", viewport: { width: 360, height: 740 } },
] as const;

for (const mode of MODES) {
  test.describe(mode.name, () => {
    for (const [name, url] of PAGES) {
      test(`${name}: nincs serious/critical axe-hiba`, async ({ browser }) => {
        const context = await browser.newContext({ colorScheme: mode.scheme, viewport: mode.viewport, locale: "hu-HU" });
        const page = await context.newPage();
        await page.goto(url);
        await expect(page.locator("main, #main, [role='main']").first()).toBeVisible();

        const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
        const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
        expect(serious.map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`)).toEqual([]);

        if (mode.viewport.width < 768) {
          expect(await smallTargets(page, 44)).toEqual([]);
          expect(await overflowingElements(page)).toEqual([]);
        }
        await context.close();
      });
    }
  });
}

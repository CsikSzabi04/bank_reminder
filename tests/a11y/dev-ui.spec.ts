import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// Automata hozzáférhetőségi ellenőrzés (axe): 0 serious/critical hiba világos és sötét módban (§22.1, B-29 előzetes)
for (const scheme of ["light", "dark"] as const) {
  test(`/dev/ui (${scheme}): nincs serious/critical axe-hiba`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: scheme, locale: "hu-HU" });
    const page = await context.newPage();
    await page.goto("/dev/ui");
    await expect(page.getByRole("heading", { name: "/dev/ui" })).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`),
    ).toEqual([]);
    await context.close();
  });
}

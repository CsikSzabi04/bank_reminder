import { expect, test } from "@playwright/test";

// A shell három töréspontja (§14.3): 360 alsó fül-sáv · 768 ikon-sín · 1280 oldalsáv
const SIZES = [
  { name: "mobil", width: 360, height: 740 },
  { name: "tablet", width: 768, height: 900 },
  { name: "asztal", width: 1280, height: 800 },
] as const;

for (const { name, width, height } of SIZES) {
  test(`shell ${name} (${width}px): pontosan egy látható fő navigáció, nincs vízszintes görgetés`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/dev/ui");
    // a láthatatlan (display:none) navigációk nem számítanak a hozzáférhetőségi fában
    await expect(page.getByRole("navigation", { name: "Fő navigáció" })).toHaveCount(1);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("sötét rendszer-beállításnál az első festés előtt már a dark osztály van (nincs villanás)", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  const page = await context.newPage();
  await page.goto("/dev/ui", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveClass(/dark/);
  await context.close();
});

test("téma- és nyelvváltó működik, a nyelv újratöltés után is megmarad", async ({ page }) => {
  await page.goto("/dev/ui");
  await page.getByRole("button", { name: "Sötét" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: /Theme · Language/ })).toBeVisible();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("az „Ugrás a tartalomhoz” link az első Tab-ra előbukkan", async ({ page }) => {
  await page.goto("/dev/ui");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Ugrás a tartalomhoz" })).toBeVisible();
});

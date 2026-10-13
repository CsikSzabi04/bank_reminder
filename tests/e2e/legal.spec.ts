import { expect, test } from "@playwright/test";

for (const [path, heading, english] of [
  ["/privacy", "Adatkezelési tájékoztató", "Privacy Policy"],
  ["/terms", "Általános szerződési feltételek", "Terms of Service"],
] as const) {
  test(`${path}: kijelentkezve elérhető, „TERVEZET” jelzéssel, HU és EN`, async ({ page }) => {
    await page.goto(path);
    await expect(page).toHaveURL(new RegExp(`${path}$`)); // nem irányít át a belépésre
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("TERVEZET");

    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { level: 1, name: english })).toBeVisible();
    await expect(page.getByRole("note")).toContainText("DRAFT");
  });
}

test("a regisztráció jelölőnégyzete az adatkezelési és az ÁSZF oldalra linkel", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("link", { name: "Adatkezelési tájékoztatót" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "ÁSZF" })).toHaveAttribute("href", "/terms");
});

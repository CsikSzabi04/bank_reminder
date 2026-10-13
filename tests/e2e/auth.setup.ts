import { expect, test as setup } from "@playwright/test";
import { resetAccount } from "./support/db";
import { AUTH_FILE } from "./support/paths";

// Belépés a teszt-fiókkal, a session mentése az authentikált tesztekhez. A hitelesítő adat csak a
// gitignore-os .env.e2e.local-ból jön, és sehova nem íródik ki.
setup("belépés a teszt-fiókkal", async ({ page }) => {
  setup.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, "nincs .env.e2e.local (E2E_EMAIL/E2E_PASSWORD)");

  // ismert alaphelyzet még a belépés előtt (a belépéskor a profil nyelve kerül a sütibe)
  await resetAccount();

  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Jelszó", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Belépés" }).last().click();

  await expect(page, "a belépés nem sikerült a teszt-fiókkal").toHaveURL(/\/dashboard$/);
  await page.context().storageState({ path: AUTH_FILE });
});

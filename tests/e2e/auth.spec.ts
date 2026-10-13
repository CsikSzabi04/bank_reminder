import { expect, test, type Page } from "@playwright/test";

// A Next route-announcer is role="alert": kizárjuk, különben a keresés nem egyértelmű
const alertOf = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

// Ezek a tesztek nem küldenek e-mailt: csak validációt és hibás/hamis adatot próbálnak.
// Az élő Supabase-t csak a hibás belépés és a hamis token érinti (400, nincs mellékhatás).

test.describe("/login", () => {
  test("megjelenik, a „Maradjak bejelentkezve” alapból be van pipálva, van jelszó-mutató", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Üdv újra!" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "Maradjak bejelentkezve" })).toBeChecked();

    const password = page.getByLabel("Jelszó", { exact: true });
    await expect(password).toHaveAttribute("type", "password");
    await page.getByRole("button", { name: "Jelszó megjelenítése" }).click();
    await expect(password).toHaveAttribute("type", "text");
  });

  test("üres űrlap: mező-hibák, a fókusz az első hibás mezőre ugrik", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Belépés" }).last().click();
    await expect(page.getByText("Ezt a mezőt ki kell töltened.").first()).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeFocused();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("aria-invalid", "true");
  });

  test("hibás e-mail formátum", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nem-email");
    await page.getByLabel("Jelszó", { exact: true }).fill("valami");
    await page.getByRole("button", { name: "Belépés" }).last().click();
    await expect(page.getByText("Adj meg érvényes e-mail címet.")).toBeVisible();
  });

  test("ismeretlen fiók: általános hibaüzenet (nem árulja el, mi hibás)", async ({ page }) => {
    test.skip(!!process.env.CI, "élő Supabase kell");
    await page.goto("/login");
    await page.getByLabel("E-mail").fill("nincs-ilyen-fiok@example.com");
    await page.getByLabel("Jelszó", { exact: true }).fill("Valami123");
    await page.getByRole("button", { name: "Belépés" }).last().click();
    await expect(alertOf(page)).toContainText("Hibás e-mail vagy jelszó.");
  });

  test("a nyelv átváltható, a cím angolra vált", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
});

test.describe("/signup", () => {
  test("a jelszó-erősség és a követelmények élőben frissülnek", async ({ page }) => {
    await page.goto("/signup");
    const password = page.getByLabel("Jelszó", { exact: true });
    await password.fill("abc");
    await expect(page.getByText("Jelszó erőssége: Gyenge")).toBeVisible();
    await password.fill("Abcdefg1");
    await expect(page.getByText("Jelszó erőssége: Megfelelő")).toBeVisible();
    await password.fill("Abcdefghijk1!");
    await expect(page.getByText("Jelszó erőssége: Erős")).toBeVisible();
  });

  test("elfogadás nélkül nem küld (nincs hálózati hívás, nincs e-mail)", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Név").fill("Teszt Elek");
    await page.getByLabel("E-mail").fill("teszt@example.com");
    await page.getByLabel("Jelszó", { exact: true }).fill("Abcdefg1");
    await page.getByRole("button", { name: "Regisztráció" }).last().click();
    await expect(page.getByText("A regisztrációhoz el kell fogadnod a feltételeket.")).toBeVisible();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test("gyenge jelszóra mező-hiba", async ({ page }) => {
    await page.goto("/signup");
    await page.getByLabel("Név").fill("Teszt Elek");
    await page.getByLabel("E-mail").fill("teszt@example.com");
    await page.getByLabel("Jelszó", { exact: true }).fill("rovid");
    await page.getByRole("button", { name: "Regisztráció" }).last().click();
    await expect(page.getByText("A jelszó legalább 8 karakter legyen.")).toBeVisible();
  });
});

test.describe("jelszó-visszaállítás és megerősítés", () => {
  test("/forgot-password: üres e-mail hibát ad", async ({ page }) => {
    await page.goto("/forgot-password");
    await page.getByRole("button", { name: "Link küldése" }).click();
    await expect(page.getByText("Ezt a mezőt ki kell töltened.")).toBeVisible();
  });

  test("/reset-password session nélkül → /forgot-password?error=otp_expired", async ({ page }) => {
    await page.goto("/reset-password");
    await expect(page).toHaveURL(/\/forgot-password\?error=otp_expired$/);
    await expect(alertOf(page)).toContainText("A link lejárt");
  });

  test("/auth/confirm paraméterek nélkül: érvénytelen link", async ({ page }) => {
    await page.goto("/auth/confirm");
    await expect(alertOf(page)).toContainText("érvénytelen vagy lejárt");
  });

  test("/auth/confirm: a token csak gombnyomásra használódik fel; hamis token → lejárt-oldal", async ({ page }) => {
    test.skip(!!process.env.CI, "élő Supabase kell");
    await page.goto("/auth/confirm?token_hash=hamis-token-1234567890&type=recovery&next=/reset-password");
    await expect(page.getByRole("heading", { name: "Jelszó-visszaállítás" })).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/confirm/); // az oldalbetöltés nem fogyasztotta el
    await page.getByRole("button", { name: "Folytatás" }).click();
    await expect(page).toHaveURL(/\/forgot-password\?error=otp_expired$/);
  });

  test("/check-email: általános szöveg és 60 mp-es újraküldés-várakozás", async ({ page }) => {
    await page.goto("/check-email?type=signup&e=teszt%40example.com");
    await expect(page.getByRole("heading", { name: /Nézd meg a leveled/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Újraküldés \d+ mp múlva/ })).toBeDisabled();
  });
});

test.describe("/auth/confirm — a Supabase alap sablonjának formái", () => {
  test("?code=… (PKCE) a callback-útvonalra megy; ha a csere nem sikerül, lejárt-üzenet a belépésen", async ({ page }) => {
    test.skip(!!process.env.CI, "élő Supabase kell");
    await page.goto("/auth/confirm?code=hamis-kod-123&next=/dashboard");
    await expect(page).toHaveURL(/\/login\?error=linkExpired$/);
    await expect(alertOf(page)).toContainText("A link lejárt");
  });

  test("?error=…&error_code=otp_expired barátságos üzenet + új levél kérése", async ({ page }) => {
    await page.goto("/auth/confirm?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired");
    await expect(alertOf(page)).toContainText("A link lejárt");
    await expect(page.getByRole("link", { name: "Új levél kérése" })).toHaveAttribute("href", /\/check-email/);
  });

  test("ismeretlen hibakód általános üzenetet ad", async ({ page }) => {
    await page.goto("/auth/confirm?error=server_error&error_code=unexpected_failure");
    await expect(alertOf(page)).toContainText("Nem sikerült megerősíteni");
  });
});

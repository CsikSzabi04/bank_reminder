import { expect, test } from "@playwright/test";
import { hasE2eAccount } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");

// B-40 (/bank váz): navigáció, szakasz az URL-ben, `bank_sync_allowed`-függő megjelenítés.
// A teszt-fiók `bank_sync_allowed` értéke hamis (a kliens nem is állíthatja, ezért a „jogosult" ágat az
// A-41 utáni közös teszt, B-41 fedi) → itt a korlátozott megjelenést ellenőrizzük.
const SECTIONS = "Bank-oldal szakaszai";

test("asztalon az oldalsáv „Bank-összekötés” eleme a Keretek és a Megtakarítás között, aktívként jelölve", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bank");
  const primary = page.getByRole("navigation", { name: "Fő navigáció" });
  const names = await primary.getByRole("link").allTextContents();
  expect(names.indexOf("Bank-összekötés")).toBe(names.indexOf("Keretek") + 1);
  expect(names.indexOf("Megtakarítás")).toBe(names.indexOf("Bank-összekötés") + 1);
  await expect(primary.getByRole("link", { name: "Bank-összekötés" })).toHaveAttribute("aria-current", "page");
});

test("tableten az ikon-sínen elérhető (felirat az aria-labelben)", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Bank-összekötés" }).click();
  await expect(page).toHaveURL(/\/bank$/);
  await expect(page.getByRole("link", { name: "Bank-összekötés" })).toHaveAttribute("aria-current", "page");
});

test("mobilon a „Még” lapról érhető el", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Még" }).click();
  await page.getByRole("dialog", { name: "Még" }).getByRole("link", { name: "Bank-összekötés" }).click();
  await expect(page).toHaveURL(/\/bank$/);
  await expect(page.getByRole("heading", { level: 1, name: "Bank-összekötés" })).toBeVisible();
});

test("jogosultság nélkül (alapeset) az Android-szakasz a nyitó oldal, az összekötés csak magyarázat", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bank");
  const nav = page.getByRole("navigation", { name: SECTIONS });
  for (const name of ["Összekötés", "Android-értesítések", "Szabályok"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Android-értesítések" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Összekötés" }).click();
  await expect(page).toHaveURL(/section=overview$/);
  await expect(nav.getByRole("link", { name: "Összekötés" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Ez a funkció jelenleg csak a fejlesztő saját számláira érhető el.")).toBeVisible();
  // nincs összekötés-gomb: az Enable-szakasz rejtett
  await expect(page.getByRole("button", { name: /Összekötés az Enable/ })).toHaveCount(0);
});

test("a szakasz az URL-ben él: frissítés után is megmarad, ismeretlen érték a nyitó szakaszra esik", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bank?section=rules");
  await page.reload();
  const nav = page.getByRole("navigation", { name: SECTIONS });
  await expect(nav.getByRole("link", { name: "Szabályok" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: "Nincs besorolásra váró tétel" })).toBeVisible();

  await page.goto("/bank?section=nincs-ilyen");
  await expect(nav.getByRole("link", { name: "Android-értesítések" })).toHaveAttribute("aria-current", "page");
});

test("mobilon szakasz nélkül lista, szakasszal a részlet és a „Vissza” link", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/bank");
  const nav = page.getByRole("navigation", { name: SECTIONS });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("link", { name: "Vissza a bank-oldalhoz" })).toBeHidden();

  await nav.getByRole("link", { name: "Android-értesítések" }).click();
  await expect(page).toHaveURL(/section=android$/);
  await expect(nav).toBeHidden();
  await page.getByRole("link", { name: "Vissza a bank-oldalhoz" }).click();
  await expect(nav).toBeVisible();
});

// B-41: a /bank/callback útvonal (az Enable-ben ez a regisztrált átirányítás). Itt csak azok az ágak futnak, amelyek
// a szervert nem hívják (a bank hibája, hibás paraméter) — a teljes folyamat az A-47 után, a Mock ASPSP-vel megy.
const STATE = "90b5c609-a1f5-4140-80e5-e4349b91b7cb";
const CODE = "ef69c617-c894-46bf-9186-4f9e4d522884";

test("callback: ha a bankban megtagadták, barátságos hiba jelenik meg, és az URL-ből eltűnik a state", async ({ page }) => {
  await page.goto(`/bank/callback?state=${STATE}&error=access_denied`);
  await expect(page).toHaveURL(/\/bank\?section=overview&result=error&reason=bank_denied$/);
  await expect(page.getByRole("alert").filter({ hasText: "nem hagytad jóvá a hozzáférést" })).toBeVisible();
  expect(page.url()).not.toContain(STATE);
});

test("callback: hiányzó vagy hibás paraméterrel nem jön létre semmi, érthető hiba látszik", async ({ page }) => {
  await page.goto(`/bank/callback?code=${CODE}`);
  await expect(page).toHaveURL(/reason=invalid_callback$/);
  await expect(page.getByRole("alert").filter({ hasText: "visszairányítása hibás volt" })).toBeVisible();

  await page.goto("/bank/callback?code=%3Cscript%3E&state=%3Cb%3E");
  await expect(page).toHaveURL(/reason=invalid_callback$/);
});

test("az URL-ből csak ismert visszajelzés olvasható ki, tetszőleges szöveg nem tükröződik vissza", async ({ page }) => {
  await page.goto("/bank?section=overview&result=error&reason=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
  await expect(page.getByRole("alert").filter({ hasText: "Valami nem sikerült" })).toBeVisible();
  await expect(page.locator("main img[src='x']")).toHaveCount(0);

  await page.goto("/bank?section=overview&result=connected");
  await expect(page.getByRole("status").filter({ hasText: "Az összekötés sikerült" })).toBeVisible();
});

test("az összekötés-gomb jogosultság nélkül nem jelenik meg, az oldal nem hibázik a callback után sem", async ({ page }) => {
  await page.goto(`/bank/callback?state=${STATE}&error=server_error`);
  await expect(page.getByRole("button", { name: /Összekötés az Enable/ })).toHaveCount(0);
  await expect(page.getByText("Ez a funkció jelenleg csak a fejlesztő saját számláira érhető el.")).toBeVisible();
});

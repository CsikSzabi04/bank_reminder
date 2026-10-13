import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";
import { overflowingElements } from "../support/layout";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-26: az onboarding 3 lépése élő adaton; a profil-változásokat a DB-ből olvassuk vissza, az eredeti állapotot visszaállítjuk
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
let original: { onboarding_done: boolean; base_currency: string; timezone: string } | null = null;

const profile = async () => (await db.client.from("profiles").select("onboarding_done, base_currency, timezone").eq("id", db.userId).single()).data!;
const reopen = () => db.client.from("profiles").update({ onboarding_done: false, base_currency: "HUF" }).eq("id", db.userId);

test.beforeAll(async () => {
  db = await userClient();
  original = await profile();
  await purgeReminders(db.client);
  await reopen();
});
test.afterAll(async () => {
  await purgeReminders(db.client);
  if (original) await db.client.from("profiles").update(original).eq("id", db.userId);
});

test("1. lépés: nyelv/téma kapcsoló, pénznem és automatikus időzóna mentése", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { level: 1, name: /^Szia, / })).toBeVisible();
  await expect(page.getByText("1. lépés / 3")).toBeVisible();
  await expect(page.getByRole("group", { name: "Nyelv" })).toBeVisible();
  await expect(page.getByRole("group", { name: "Téma" })).toBeVisible();
  // az időzóna a böngészőből (nem a szerver-alapérték) látszik
  const detected = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  await expect(page.getByText(detected, { exact: true })).toBeVisible();

  await page.getByLabel("Alap-pénznem").selectOption("EUR");
  await page.getByRole("button", { name: "Tovább" }).click();
  await expect(page).toHaveURL(/step=2/);
  const p = await profile();
  expect(p.base_currency).toBe("EUR");
  expect(p.timezone).toBe(detected);
  expect(p.onboarding_done).toBe(false);
  await db.client.from("profiles").update({ base_currency: "HUF" }).eq("id", db.userId);
});

for (const step of [1, 2, 3]) {
  for (const scheme of ["light", "dark"] as const) {
    test(`${step}. lépés (${scheme}): nincs serious/critical axe-hiba, nincs vízszintes túlcsordulás 360 px-en`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 360, height: 740 });
      await page.goto(`/onboarding?step=${step}`);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForFunction(() => !!sessionStorage.getItem("br_profile_synced"));
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
      const serious = results.violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`);
      expect(serious).toEqual([]);
      expect(await overflowingElements(page)).toEqual([]);
    });
  }
}

test("érvénytelen lépés-paraméter → 1. lépés", async ({ page }) => {
  await page.goto("/onboarding?step=99");
  await expect(page.getByText("1. lépés / 3")).toBeVisible();
});

test("2. lépés: gyors-hozzáadás chipek; az előtöltött űrlap mentése után a 3. lépés jön", async ({ page }) => {
  await page.goto("/onboarding?step=2");
  await expect(page.getByText("2. lépés / 3")).toBeVisible();
  for (const name of ["Netflix", "Spotify", "HBO Max", "Áram", "Gáz", "Internet", "Telefon", "Albérlet"]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }

  await page.getByRole("link", { name: "Netflix", exact: true }).click();
  await expect(page).toHaveURL(/\/reminders\/new\?service=netflix&onboarding=1/);
  await expect(page.getByLabel("Név")).toHaveValue("Netflix");
  // „Mégse" visszavisz az onboardingra
  await expect(page.getByRole("link", { name: "Mégse" })).toHaveAttribute("href", "/onboarding?step=2");

  await page.getByLabel("Összeg").fill("2 990");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(/\/onboarding\?step=3/);
  const r = (await db.client.from("reminders").select("name, amount").eq("name", "Netflix")).data ?? [];
  expect(r).toHaveLength(1);
  expect(r[0].amount).toBe(2990);
});

test("3. lépés: értesítés-panel + telepítés; a Kész lezárja az onboardingot", async ({ page }) => {
  await page.goto("/onboarding?step=3");
  await expect(page.getByText("3. lépés / 3")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: "Értesítések és telepítés" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Telepítési útmutató" })).toBeVisible();

  await page.getByRole("button", { name: "Kész, irány a Főoldal" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await profile()).onboarding_done).toBe(true);

  // kész onboarding után nem jön elő újra
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("Kihagyom: bármelyik lépésről a Főoldalra, onboarding_done = true", async ({ page }) => {
  await reopen();
  await page.goto("/onboarding?step=2");
  await page.getByRole("button", { name: "Kihagyom" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  expect((await profile()).onboarding_done).toBe(true);
});

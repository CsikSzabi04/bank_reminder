import { expect, request as apiRequest, test } from "@playwright/test";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-28 (Profil II.): megjelenés-kapcsolók, pénzügyek + saját kategóriák, biztonság (csak validáció — a fiók jelszavát
// és e-mailjét nem módosítjuk), adatexport (JSON/CSV + CSV-injekció), fiók-törlés (csak a védelem; a törlést nem hajtjuk végre), névjegy.
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
let original: { base_currency: string; timezone: string; monthly_income: number | null } | null = null;
const REMINDER_NAME = '=HYPERLINK("http://evil.example","katt")';

async function cleanup() {
  await db.client.from("categories").delete().like("name_hu", "E2E %");
  await db.client.from("reminders").delete().eq("name", REMINDER_NAME);
}

test.beforeAll(async () => {
  db = await userClient();
  original = (await db.client.from("profiles").select("base_currency, timezone, monthly_income").eq("id", db.userId).single()).data;
  await cleanup();
});
test.afterAll(async () => {
  await cleanup();
  if (original) await db.client.from("profiles").update(original).eq("id", db.userId);
});

test("a profil mind a 7 szakaszt listázza, a szakasz az URL-ben él", async ({ page }) => {
  await page.goto("/profile");
  const nav = page.getByRole("navigation", { name: "Profil szakaszai" });
  for (const name of ["Áttekintés", "Megjelenés", "Értesítések", "Pénzügyek", "Biztonság", "Adataim", "Névjegy"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await nav.getByRole("link", { name: "Pénzügyek" }).click();
  await expect(page).toHaveURL(/section=finance$/);
  await expect(page.getByRole("heading", { level: 2, name: "Pénzügyi beállítások" })).toBeVisible();
});

test("megjelenés: kontraszt- és mozgás-kapcsoló a <html>-re hat, újratöltés után is", async ({ page }) => {
  await page.goto("/profile?section=appearance");
  const contrast = page.getByRole("switch", { name: "Kontrasztosabb diagramok" });
  const motion = page.getByRole("switch", { name: "Kevesebb mozgás" });
  await expect(contrast).toHaveAttribute("aria-checked", "false");

  await contrast.click();
  await motion.click();
  await expect(contrast).toHaveAttribute("aria-checked", "true");
  await expect(page.locator("html")).toHaveAttribute("data-contrast-charts", "1");
  await expect(page.locator("html")).toHaveAttribute("data-reduce-motion", "1");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-contrast-charts", "1");
  await expect(page.getByRole("switch", { name: "Kevesebb mozgás" })).toHaveAttribute("aria-checked", "true");

  // billentyűvel is kapcsolható (Space), és visszaállítható
  await page.getByRole("switch", { name: "Kontrasztosabb diagramok" }).focus();
  await page.keyboard.press("Space");
  await page.getByRole("switch", { name: "Kevesebb mozgás" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-contrast-charts", "1");
  await expect(page.locator("html")).not.toHaveAttribute("data-reduce-motion", "1");
});

test("pénzügyek: érvénytelen időzóna mezőhiba; érvényes mentés a DB-be; jövedelem törölhető", async ({ page }) => {
  await page.goto("/profile?section=finance");
  await page.getByLabel("Időzóna").fill("Nem/Letezik");
  await page.getByRole("button", { name: "Mentés" }).first().click();
  await expect(page.getByLabel("Időzóna")).toHaveValue("Nem/Letezik"); // a beírt érték megmarad
  await expect(page.getByText("Ez az érték nem érvényes.")).toBeVisible();

  await page.getByLabel("Alap-pénznem").selectOption("EUR");
  await page.getByLabel("Időzóna").fill("Europe/Berlin");
  await page.getByLabel(/Havi jövedelem/).fill("1 200,50");
  await page.getByRole("button", { name: "Mentés" }).first().click();
  await expect(page.getByText("Elmentve.")).toBeVisible();
  const p = (await db.client.from("profiles").select("base_currency, timezone, monthly_income").eq("id", db.userId).single()).data;
  expect(p).toEqual({ base_currency: "EUR", timezone: "Europe/Berlin", monthly_income: 1200.5 });

  await page.getByLabel(/Havi jövedelem/).fill("");
  await page.getByLabel("Alap-pénznem").selectOption(original?.base_currency ?? "HUF");
  await page.getByLabel("Időzóna").fill(original?.timezone ?? "Europe/Budapest");
  await page.getByRole("button", { name: "Mentés" }).first().click();
  await expect(page.getByText("Elmentve.")).toBeVisible();
  // az előző mentés „Elmentve." üzenete még látszik → a DB-t várakozással olvassuk
  await expect.poll(async () => (await db.client.from("profiles").select("monthly_income").eq("id", db.userId).single()).data?.monthly_income).toBeNull();
});

test("saját kategória: létrehozás, szerkesztés, megerősített törlés; a rendszer-kategória nem érintett", async ({ page }) => {
  await page.goto("/profile?section=finance");
  await page.getByRole("button", { name: "Új kategória" }).click();
  const sheet = page.getByRole("dialog", { name: "Új kategória" });

  // név nélkül: hiba
  await sheet.getByRole("button", { name: "Mentés" }).click();
  await expect(sheet.getByText("Ezt a mezőt ki kell töltened.")).toBeVisible();

  await sheet.getByLabel("Név (magyar)").fill("E2E Háziállat");
  await sheet.getByLabel("Név (angol)").fill("E2E Pets");
  await sheet.getByText("Kiadás", { exact: true }).click();
  await sheet.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("A kategória elmentve.")).toBeVisible();
  await expect(page.getByText("E2E Háziállat")).toBeVisible();
  const row = (await db.client.from("categories").select("id, key, kind, color_slot").eq("name_hu", "E2E Háziállat").single()).data!;
  expect(row.key).toBeNull();
  expect(row.kind).toBe("expense");

  await page.getByRole("button", { name: "E2E Háziállat szerkesztése" }).click();
  await page.getByRole("dialog", { name: "Kategória szerkesztése" }).getByLabel("Név (magyar)").fill("E2E Kedvenc");
  await page.getByRole("dialog", { name: "Kategória szerkesztése" }).getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("E2E Kedvenc")).toBeVisible();

  await page.getByRole("button", { name: "E2E Kedvenc törlése" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Törlés" }).click();
  await expect(page.getByText("A kategória törölve.")).toBeVisible();
  expect((await db.client.from("categories").select("id").like("name_hu", "E2E %")).data).toEqual([]);
});

test("biztonság: a jelszó-űrlap validál (gyenge / eltérő), az e-mail-űrlap azonos címet elutasít — nem módosítunk valódi adatot", async ({ page }) => {
  await page.goto("/profile?section=security");
  await page.getByLabel("Új jelszó", { exact: true }).fill("abc");
  await page.getByLabel("Új jelszó még egyszer").fill("xyz");
  await page.getByRole("button", { name: "Jelszó mentése" }).click();
  await expect(page.getByLabel("Új jelszó", { exact: true })).toHaveValue("abc"); // megmarad
  await expect(page.getByRole("alert").first()).toBeVisible();

  await page.getByLabel("Új e-mail-cím").fill(process.env.E2E_EMAIL!);
  await page.getByRole("button", { name: "Megerősítő levél küldése" }).click();
  await expect(page.getByText("Ez a jelenlegi címed.")).toBeVisible();
});

test("adatexport: JSON és CSV letöltés fejlécekkel; a CSV-injekció (=képlet) aposztróffal védett; kijelentkezve 401", async ({ page, baseURL }) => {
  await db.client.from("reminders").insert({ name: REMINDER_NAME, amount: 100, currency: "HUF", start_date: "2030-01-01", recur_unit: "month", recur_every: 1 });

  const json = await page.request.get("/api/export?format=json");
  expect(json.status()).toBe(200);
  expect(json.headers()["content-disposition"]).toMatch(/^attachment; filename="bank-reminder-\d{4}-\d{2}-\d{2}\.json"$/);
  expect(json.headers()["cache-control"]).toContain("no-store");
  const body = await json.json();
  for (const key of ["profile", "reminders", "occurrences", "expenses", "budgets"]) expect(body).toHaveProperty(key);
  expect(JSON.stringify(body.profile)).not.toContain("ics_token"); // a naptár-token nem kerül az exportba

  const csv = await page.request.get("/api/export?format=csv&table=reminders");
  expect(csv.status()).toBe(200);
  expect(csv.headers()["content-type"]).toContain("text/csv");
  const text = await csv.text();
  expect(text.charCodeAt(0)).toBe(0xfeff); // BOM az Excel-hez
  expect(text).toContain("'=HYPERLINK"); // aposztróf-előtag: nem fut le képletként
  expect(text).not.toMatch(/(^|,)"?=HYPERLINK/m);

  expect((await page.request.get("/api/export?format=csv&table=profiles")).status()).toBe(400);
  expect((await page.request.get("/api/export?format=xml")).status()).toBe(400);

  const anon = await apiRequest.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
  expect((await anon.get("/api/export?format=json")).status()).toBe(401);
  await anon.dispose();
});

test("adataim: letöltő linkek; a fiók-törlés gombja a megerősítő szó beírásáig tiltott (a törlést nem hajtjuk végre)", async ({ page }) => {
  await page.goto("/profile?section=data");
  await expect(page.getByRole("link", { name: "Minden adat (JSON)" })).toHaveAttribute("href", "/api/export?format=json");
  await expect(page.getByRole("link", { name: "Emlékeztetők (CSV)" })).toBeVisible();

  const submit = page.getByRole("button", { name: "Fiók végleges törlése" });
  await expect(submit).toBeDisabled();
  await page.getByLabel(/A megerősítéshez írd be: TÖRLÖM/).fill("TÖRLÖ");
  await expect(submit).toBeDisabled();
  await page.getByLabel(/A megerősítéshez írd be/).fill("törlöm");
  await expect(submit).toBeEnabled();
  await page.getByLabel(/A megerősítéshez írd be/).fill("");
  await expect(submit).toBeDisabled();
});

test("névjegy: jogi linkek, a „nem bank” szöveg; a búcsú-oldal kijelentkezve is elérhető", async ({ page, browser }) => {
  await page.goto("/profile?section=about");
  await expect(page.getByRole("link", { name: "Adatkezelési tájékoztató" })).toHaveAttribute("href", "/privacy");
  await expect(page.getByRole("link", { name: "Felhasználási feltételek" })).toHaveAttribute("href", "/terms");
  await expect(page.getByText(/nem bank és nem pénzügyi tanácsadó/)).toBeVisible();

  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, locale: "hu-HU" });
  const anon = await ctx.newPage();
  await anon.goto("/goodbye");
  await expect(anon.getByRole("heading", { level: 1, name: "A fiókodat töröltük" })).toBeVisible();
  await expect(anon.getByRole("link", { name: "Új fiók létrehozása" })).toHaveAttribute("href", "/signup");
  await ctx.close();
});

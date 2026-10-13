import { expect, test } from "@playwright/test";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-24: tippek élő adaton (a minta-adatban Netflix / HBO Max / Prime Video átfedő előfizetések). A tippeket az A-oldali
// motor számolja (refresh_tips); a UI csak a kód+paraméter → locales szöveget mutatja, és a státuszváltást a DB végzi.
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
const tipRows = async () => (await db.client.from("tips").select("id, code, status, snoozed_until, est_monthly_saving, reminder_ids")).data ?? [];

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
  await db.client.from("profiles").update({ tips_enabled: true }).eq("id", db.userId);
  await db.client.rpc("load_demo_data");
  // lejáró próba (3 napon belül) → a „Figyelj rá" szint is van
  const today = (await db.client.rpc("user_today")).data as string;
  const trialEnd = new Date(`${today}T00:00:00Z`);
  trialEnd.setUTCDate(trialEnd.getUTCDate() + 2);
  await db.client.from("reminders").insert({
    name: "E2E Próba",
    amount: 2990,
    currency: "HUF",
    start_date: today,
    recur_unit: "month",
    recur_every: 1,
    is_subscription: true,
    trial_ends_on: trialEnd.toISOString().slice(0, 10),
  });
  await db.client.rpc("refresh_tips");
});
test.afterAll(async () => {
  await db.client.from("profiles").update({ tips_enabled: true }).eq("id", db.userId);
  await purgeReminders(db.client);
});

// Megjegyzés: az `overlap:<csoport>` ujjlenyomat stabil, ezért az elvetett/kész átfedés-tipp egy fiókon nem tér vissza
// (ez a kívánt működés); a tesztek ezért az emlékeztetőnként egyedi ujjlenyomatú tippekre épülnek.
test("Mit nézel itt?: a címkék mentődnek, a fedett előfizetésre lemondási tipp jön", async ({ page }) => {
  await page.goto("/tips");
  const ask = page.getByRole("article").filter({ has: page.getByRole("heading", { name: "Mit nézel a(z) Prime Video előfizetésen?" }) });
  await ask.getByRole("button", { name: "Filmek" }).click();
  await ask.getByRole("button", { name: "Sorozatok" }).click();
  await ask.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Elmentettük, újraszámoltuk a tippeket.")).toBeVisible();
  const prime = (await db.client.from("reminders").select("usage_tags").eq("name", "Prime Video").single()).data;
  expect([...(prime?.usage_tags ?? [])].sort()).toEqual(["movies", "series"]);

  // a Netflix ugyanazt jelölve → mindkettő fedett; a motor a legdrágábbat ajánlja lemondásra (csoportonként egyet)
  await db.client.from("reminders").update({ usage_tags: ["movies", "series"] }).eq("name", "Netflix");
  await db.client.rpc("refresh_tips");
  await page.reload();
  await expect(page.getByRole("heading", { level: 3, name: /lemondása lehet/ }).first()).toBeVisible();
});

test("áttekintés: szintek, becslés, összesítő és állandó figyelmeztetés", async ({ page }) => {
  await page.goto("/tips");
  await expect(page.getByRole("heading", { level: 1, name: "Tippek" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Spórolhatsz" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Figyelj rá" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 3, name: /E2E Próba: közeledik/ })).toBeVisible();
  await expect(page.getByText(/kb\.\s.*Ft\/hó/).first()).toBeVisible();
  await expect(page.getByText(/Összesen akár kb\./)).toBeVisible();
  await expect(page.getByText(/nem minősülnek pénzügyi tanácsadásnak/)).toBeVisible();
});

test("Miért látom ezt?: a magyarázat megnyílik, a tipp megnyitottá (seen) válik", async ({ page }) => {
  await page.goto("/tips");
  const card = page.getByRole("article").filter({ has: page.getByRole("heading", { name: /lemondása lehet/ }) }).first();
  await card.getByText("Miért látom ezt?").click();
  await expect(card.getByText(/nem a szolgáltatók tartalmát ellenőriztük/)).toBeVisible();
  await expect.poll(async () => (await tipRows()).some((t) => t.code === "sub_covered_by_others" && t.status === "seen")).toBe(true);
});

test("Megcsináltam / Nem érdekel / Később: a státuszt a DB tárolja, a tipp eltűnik, nem tér vissza", async ({ page }) => {
  await page.goto("/tips");
  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  expect(before).toBeGreaterThanOrEqual(3);

  // 1. Megcsináltam (a legnagyobb becslésű tipp) → a „Megcsináltad" összeg
  await cards.first().getByRole("button", { name: "Megcsináltam" }).click();
  await expect(page.getByText("Szuper, beleszámoltuk a megtakarításba.")).toBeVisible();
  await expect(cards).toHaveCount(before - 1);
  await expect(page.getByText(/Megcsináltad: kb\./)).toBeVisible();
  expect((await tipRows()).filter((t) => t.status === "done").length).toBeGreaterThanOrEqual(1);

  // 2. Nem érdekel
  await cards.first().getByRole("button", { name: "Nem érdekel" }).click();
  await expect(page.getByText("Elrejtettük, nem jön vissza.")).toBeVisible();
  await expect(cards).toHaveCount(before - 2);
  expect((await tipRows()).filter((t) => t.status === "dismissed").length).toBeGreaterThanOrEqual(1);

  // 3. Később (30 nap)
  await cards.first().getByRole("button", { name: "Később" }).click();
  await expect(page.getByText("30 nap múlva újra megmutatjuk.")).toBeVisible();
  const snoozed = (await tipRows()).find((t) => t.status === "snoozed");
  expect(snoozed?.snoozed_until).toBeTruthy();

  // a refresh nem hozza vissza az elvetett / halasztott / kész tippet
  const settled = new Set((await tipRows()).filter((t) => ["done", "dismissed", "snoozed"].includes(t.status)).map((t) => t.id));
  await db.client.rpc("refresh_tips");
  const after = await tipRows();
  for (const id of settled) expect(["done", "dismissed", "snoozed"]).toContain(after.find((t) => t.id === id)?.status);
});

test("Főoldal: legfeljebb egy tipp a teaserben, link a /tips-re", async ({ page }) => {
  await page.goto("/dashboard");
  const teaser = page.getByRole("region", { name: "Tipp" });
  if (await teaser.count()) {
    await expect(teaser).toHaveCount(1);
    await teaser.getByRole("link", { name: "Összes tipp" }).click();
    await expect(page).toHaveURL(/\/tips$/);
  }
});

test("tippek kikapcsolása: üres állapot, a Főoldalon nincs teaser; visszakapcsolás", async ({ page }) => {
  await page.goto("/tips");
  await page.getByRole("button", { name: "Tippek kikapcsolása" }).click();
  await expect(page.getByText("A tippek ki vannak kapcsolva")).toBeVisible();
  expect((await db.client.from("profiles").select("tips_enabled").eq("id", db.userId).single()).data?.tips_enabled).toBe(false);
  await page.goto("/dashboard");
  await expect(page.getByRole("region", { name: "Tipp" })).toHaveCount(0);

  await page.goto("/tips");
  await page.getByRole("button", { name: "Tippek bekapcsolása" }).click();
  await expect(page.getByRole("heading", { level: 2, name: "A tippek ki vannak kapcsolva" })).toHaveCount(0);
  expect((await db.client.from("profiles").select("tips_enabled").eq("id", db.userId).single()).data?.tips_enabled).toBe(true);
});

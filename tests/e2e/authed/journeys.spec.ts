import { expect, request as apiRequest, test } from "@playwright/test";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-30: a J4 folyamat végig (értesítés érkezik → megnyitás → kifizetés) és a service worker értesítés-gombjainak végpontja
// élő adaton. (J3: reminders.spec · J2/J8: auth.spec · J5: pwa.spec · J6: notifications.spec · J7: analytics/budgets/tips/news.spec)
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
const today = async () => (await db.client.rpc("user_today")).data as string;
const occ = async (reminderId: string) =>
  (await db.client.from("v_occurrences").select("id, status, due_date").eq("reminder_id", reminderId).order("due_date").limit(1).single()).data!;

async function seed(name: string, amount: number) {
  const { data, error } = await db.client
    .from("reminders")
    .insert({ name, amount, currency: "HUF", start_date: await today(), recur_unit: "month", recur_every: 1, remind_offsets: [0], remind_time: "00:00:00" })
    .select("id")
    .single();
  if (error || !data) throw new Error("a teszt-emlékeztető létrehozása sikertelen");
  return data.id;
}

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

test("J4: az értesítés megjelenik a harangon, megnyitva az esedékességhez visz, onnan kifizethető", async ({ page }) => {
  const reminderId = await seed("J4 Netflix", 2300);
  const o = await occ(reminderId);
  expect(o.status).toBe("upcoming");

  // 1. a harang olvasatlan számlálója és az értesítés szövege (a mai nap, összeg)
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /^Értesítések, \d+ olvasatlan$/ })).toBeVisible();
  await page.getByRole("link", { name: /^Értesítések, \d+ olvasatlan$/ }).click();
  await expect(page).toHaveURL(/\/notifications$/);
  const item = page.getByRole("link", { name: /J4 Netflix/ }).first();
  await expect(item).toContainText(/ma esedékes/);
  await expect(item).toContainText(/2\s300\sFt/);

  // 2. koppintás → az esedékesség-részletek (?occ=…), az értesítés olvasottá válik
  await item.click();
  await expect(page).toHaveURL(new RegExp(`/reminders/${reminderId}\\?occ=${o.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: "J4 Netflix" })).toBeVisible();
  await expect.poll(async () => ((await db.client.from("notifications").select("read_at").eq("reminder_id", reminderId).eq("channel", "in_app")).data ?? []).every((n) => n.read_at !== null)).toBe(true);

  // 3. kifizetés az esedékesség-sorról → a DB-ben paid
  await page.getByRole("button", { name: /kifizetettnek jelölése/ }).first().click();
  await expect.poll(async () => (await db.client.from("v_occurrences").select("status").eq("id", o.id!).single()).data?.status).toBe("paid");
});

test("értesítés-gomb végpontok: kifizettem + holnap emlékeztess; idegen Origin, rossz azonosító, ismeretlen művelet, kijelentkezve elutasítva", async ({ page, baseURL }) => {
  const [a, b] = [await seed("J4 Gomb-kifizet", 1000), await seed("J4 Gomb-halaszt", 2000)];
  const [oa, ob] = [await occ(a), await occ(b)];
  const origin = new URL(baseURL!).origin;
  const post = (path: string, headers: Record<string, string> = { origin }) => page.request.post(path, { headers });

  expect((await post(`/api/occurrences/${oa.id}/paid`)).status()).toBe(200);
  await expect.poll(async () => (await db.client.from("v_occurrences").select("status").eq("id", oa.id!).single()).data?.status).toBe("paid");

  expect((await post(`/api/occurrences/${ob.id}/snooze`)).status()).toBe(200);
  const snoozed = (await db.client.from("v_occurrences").select("snoozed_until, status").eq("id", ob.id!).single()).data;
  expect(snoozed?.status).toBe("upcoming");
  expect(snoozed?.snoozed_until).toBeTruthy();

  // 🔴 védelmek
  expect((await post(`/api/occurrences/${ob.id}/paid`, { origin: "https://evil.example" })).status()).toBe(403);
  expect((await post(`/api/occurrences/nem-uuid/paid`)).status()).toBe(400);
  expect((await post(`/api/occurrences/${ob.id}/torles`)).status()).toBe(404);
  expect((await db.client.from("v_occurrences").select("status").eq("id", ob.id!).single()).data?.status).toBe("upcoming");

  const anon = await apiRequest.newContext({ baseURL: baseURL!, storageState: { cookies: [], origins: [] } });
  expect((await anon.post(`/api/occurrences/${ob.id}/paid`, { headers: { origin } })).status()).toBe(401);
  await anon.dispose();
});

test("J2 vége: kijelentkezés után a védett oldal a belépésre visz, a belépés után a kért oldalra", async ({ page, browser }) => {
  // külön böngésző-környezet: a közös tárolt session ne vesszen el
  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] }, locale: "hu-HU" });
  const anon = await ctx.newPage();
  await anon.goto("/reminders");
  await expect(anon).toHaveURL(/\/login\?next=%2Freminders$/);
  await anon.getByLabel("E-mail").fill(process.env.E2E_EMAIL!);
  await anon.getByLabel("Jelszó", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await anon.getByRole("button", { name: "Belépés" }).last().click();
  await expect(anon).toHaveURL(/\/reminders$/);

  await anon.getByRole("button", { name: "Kijelentkezés" }).click();
  await expect(anon).toHaveURL(/\/login/);
  await anon.goto("/dashboard");
  await expect(anon).toHaveURL(/\/login\?next=%2Fdashboard$/);
  await ctx.close();
  void page;
});

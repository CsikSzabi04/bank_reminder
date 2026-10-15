import { expect, test } from "@playwright/test";
import { cleanGoals, hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// A-48: „Bank-egyeztetés kulcsszó" (reminders.bank_match / savings_goals.bank_match) az élő adatbázissal: a kliens a DB-vel azonos,
// normalizált alakot küld; szerkesztésnél előtöltődik; törlésnél null kerül az oszlopba; a rövid kulcsszó mező-hibát ad.
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
  await cleanGoals(db.client);
});
test.afterAll(async () => {
  await purgeReminders(db.client);
  await cleanGoals(db.client);
});

const KEYWORD = "Anthropic Ltd.";

test("emlékeztető: a kulcsszó normalizálva mentődik, szerkesztésnél előtöltődik, törlésnél null", async ({ page }) => {
  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("E2E Kulcsszavas");
  await page.getByLabel("Összeg").fill("7000");
  await page.getByLabel(/Bank-egyeztetés kulcsszó/).fill(KEYWORD);
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(/\/reminders\/[0-9a-f-]{36}$/);

  const { data } = await db.client.from("reminders").select("id, bank_match").eq("name", "E2E Kulcsszavas").single();
  expect(data?.bank_match).toBe("anthropic ltd");

  await page.goto(`/reminders/${data!.id}/edit`);
  await expect(page.getByLabel(/Bank-egyeztetés kulcsszó/)).toHaveValue("anthropic ltd");
  await page.getByLabel(/Bank-egyeztetés kulcsszó/).fill("");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(new RegExp(`/reminders/${data!.id}$`));
  expect((await db.client.from("reminders").select("bank_match").eq("id", data!.id).single()).data?.bank_match).toBeNull();
});

test("emlékeztető: a túl rövid kulcsszó mező-hibát ad, nincs mentés", async ({ page }) => {
  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("E2E Rövid kulcs");
  await page.getByLabel("Összeg").fill("1000");
  await page.getByLabel(/Bank-egyeztetés kulcsszó/).fill("a");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("A kulcsszó legalább 2 betű vagy szám legyen.")).toBeVisible();
  expect((await db.client.from("reminders").select("id").eq("name", "E2E Rövid kulcs")).data).toEqual([]);
});

test("megtakarítási cél: a kulcsszó normalizálva mentődik, előtöltődik, törölhető", async ({ page }) => {
  await page.goto("/savings/new?preset=custom");
  await page.getByLabel("Cél neve").fill("E2E Nyaralás");
  await page.getByLabel("Célösszeg").fill("200000");
  await page.getByLabel(/Bank-egyeztetés kulcsszó/).fill("Nyaralás-alap");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(/\/savings\/[0-9a-f-]{36}$/);

  const { data } = await db.client.from("savings_goals").select("id, bank_match").eq("name", "E2E Nyaralás").single();
  expect(data?.bank_match).toBe("nyaralas alap");

  await page.goto(`/savings/${data!.id}/edit`);
  await expect(page.getByLabel(/Bank-egyeztetés kulcsszó/)).toHaveValue("nyaralas alap");
  await page.getByLabel(/Bank-egyeztetés kulcsszó/).fill("");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(new RegExp(`/savings/${data!.id}$`));
  expect((await db.client.from("savings_goals").select("bank_match").eq("id", data!.id).single()).data?.bank_match).toBeNull();
});

test("kulcsszó nélkül a mentés változatlanul működik, és az oszlop üres marad", async ({ page }) => {
  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("E2E Kulcsszó nélkül");
  await page.getByLabel("Összeg").fill("1500");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(/\/reminders\/[0-9a-f-]{36}$/);
  expect((await db.client.from("reminders").select("bank_match").eq("name", "E2E Kulcsszó nélkül").single()).data?.bank_match).toBeNull();
});

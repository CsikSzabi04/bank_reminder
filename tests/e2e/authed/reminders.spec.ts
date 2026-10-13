import { expect, test, type Page } from "@playwright/test";
import { todayIn } from "../../../lib/format";
import { addDays } from "../../../lib/tz";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");

// B-11/B-12/B-13 átvétele valós fiókkal és az A-oldali RPC-kkel (élő projekt). A teszt-fiók kizárólag e2e-re van:
// a teszt elején és végén minden emlékeztetőjét töröljük.
test.describe.configure({ mode: "serial" });

type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

const row = (page: Page, name: string) => page.getByRole("listitem").filter({ hasText: name }).first();

test("üres lista: tanító üres állapot, gyors-hozzáadás, minta-adat gomb", async ({ page }) => {
  await page.goto("/reminders");
  await expect(page.getByRole("heading", { name: "Még nincs emlékeztetőd" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Netflix" })).toHaveAttribute("href", /\/reminders\/new\?service=netflix/);
  await expect(page.getByRole("button", { name: "Minta-adatok betöltése" })).toBeVisible();
});

test("minta-adatok betöltése: csoportok, „Minta adat” jelvény, szűrő, ékezet-független keresés", async ({ page }) => {
  await page.goto("/reminders");
  await page.getByRole("button", { name: "Minta-adatok betöltése" }).click();
  await expect(page.getByText("Betöltöttük a minta-adatokat.")).toBeVisible();

  await expect(page.getByRole("heading", { level: 2 }).filter({ hasText: /Ezen a héten|Később ebben a hónapban|Jövő hónap|Lejárt/ }).first()).toBeVisible();
  await expect(page.getByText("Minta adat").first()).toBeVisible();

  await page.getByRole("link", { name: "Előfizetések" }).click();
  await expect(page).toHaveURL(/filter=subscriptions/);
  await expect(row(page, "Netflix")).toBeVisible();

  // "aram" megtalálja az "Áram"-ot (és nem a szűrt előfizetések között keresünk)
  await page.goto("/reminders?q=aram");
  await expect(row(page, "Áram")).toBeVisible();
  await page.goto("/reminders?q=nincsilyentetel");
  await expect(page.getByRole("heading", { name: "Nincs találat" })).toBeVisible();
});

test("Kifizettem: azonnali visszajelzés, az esedékesség a DB-ben paid; a Visszavonás visszaállítja", async ({ page }) => {
  await page.goto("/reminders");
  const pay = page.getByRole("button", { name: /kifizetettnek jelölése/ }).first();
  const label = (await pay.getAttribute("aria-label"))!;
  const name = label.replace(" kifizetettnek jelölése", "");
  const paidCount = async () => {
    const { data } = await db.client.from("reminders").select("id").eq("name", name).single();
    const { count } = await db.client.from("occurrences").select("id", { count: "exact", head: true }).eq("reminder_id", data!.id).eq("status", "paid");
    return count;
  };
  const before = await paidCount(); // a minta-adatnak már van kifizetett előzménye

  await pay.click();
  await expect(page.getByRole("status").filter({ hasText: `${name}: kifizetve` })).toBeVisible();
  await expect.poll(paidCount).toBe(before! + 1);

  await page.getByRole("button", { name: "Visszavonás" }).click();
  await expect.poll(paidCount).toBe(before);
});

test("🔔 kapcsoló: a remind_enabled a DB-ben is vált, és visszakapcsolható", async ({ page }) => {
  await page.goto("/reminders");
  const toggle = page.getByRole("switch", { name: /^Értesítés: / }).first();
  const name = (await toggle.getAttribute("aria-label"))!.replace("Értesítés: ", "");
  const enabled = async () => (await db.client.from("reminders").select("remind_enabled").eq("name", name).single()).data!.remind_enabled;

  const before = await enabled();
  await toggle.click();
  await expect.poll(enabled).toBe(!before);
  await expect(page.getByRole("switch", { name: `Értesítés: ${name}` })).toHaveAttribute("aria-checked", String(!before));
  await page.getByRole("switch", { name: `Értesítés: ${name}` }).click();
  await expect.poll(enabled).toBe(before);
});

test("⋯ menü: kihagyás (skipped a DB-ben) és szüneteltetés/folytatás", async ({ page }) => {
  await page.goto("/reminders");
  const open = page.getByRole("button", { name: /^Műveletek: / }).first();
  const name = (await open.getAttribute("aria-label"))!.replace("Műveletek: ", "");
  const id = (await db.client.from("reminders").select("id").eq("name", name).single()).data!.id;

  // szüneteltetés → "Szüneteltetett" csoport, is_active = false
  await open.click();
  await page.getByRole("dialog").getByRole("button", { name: "Szüneteltetés" }).click();
  await expect.poll(async () => (await db.client.from("reminders").select("is_active").eq("id", id).single()).data!.is_active).toBe(false);
  await expect(page.getByRole("heading", { level: 2 }).filter({ hasText: "Szüneteltetett" })).toBeVisible();

  // folytatás
  await page.getByRole("button", { name: `Műveletek: ${name}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Folytatás" }).click();
  await expect.poll(async () => (await db.client.from("reminders").select("is_active").eq("id", id).single()).data!.is_active).toBe(true);

  // megvárjuk, hogy a lista is frissüljön (a sor elhagyja a "Szüneteltetett" csoportot), különben a régi menüt nyitnánk
  await expect(page.getByRole("heading", { level: 2 }).filter({ hasText: "Szüneteltetett" })).toBeHidden();

  // kihagyás: a következő esedékesség skipped
  await page.getByRole("button", { name: `Műveletek: ${name}` }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Kihagyás" }).click();
  await expect.poll(async () => {
    const { count } = await db.client.from("occurrences").select("id", { count: "exact", head: true }).eq("reminder_id", id).eq("status", "skipped");
    return count;
  }).toBe(1);
});

test("részletoldal: fejléc, előzmény; az idegen/érvénytelen azonosító 404", async ({ page }) => {
  await page.goto("/reminders");
  await page.getByRole("link", { name: /Netflix/ }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Netflix");
  await expect(page.getByRole("heading", { name: "Előzmények" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Részletek" })).toBeVisible();

  // idegen/nem létező azonosító: saját 404 a shellen belül (a státuszt a streaming miatt nem a HTTP-kód jelzi)
  await page.goto("/reminders/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Nem találjuk az oldalt" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Vissza a főoldalra" })).toBeVisible();
  await page.goto("/reminders/nem-uuid");
  await expect(page.getByRole("heading", { name: "Nem találjuk az oldalt" })).toBeVisible();
});

test("minta-adatok törlése: a lista újra üres", async ({ page }) => {
  await page.goto("/reminders");
  await page.getByRole("button", { name: "Minta-adatok törlése" }).click();
  await expect(page.getByRole("heading", { name: "Még nincs emlékeztetőd" })).toBeVisible();
});

test("J3 — új emlékeztető 60 mp alatt: előnézet, mentés, esedékességek a DB-ben", async ({ page }) => {
  const today = todayIn("Europe/Budapest");
  const start = addDays(today, 5);

  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("E2E Netflix");
  await page.getByLabel("Összeg").fill("2 300");
  await page.getByLabel("Első esedékesség").fill(start);
  await expect(page.getByText(/^Következő: /)).toBeVisible(); // a szerver (preview_dates) számolja
  await page.getByRole("button", { name: "Mentés" }).click();

  await expect(page).toHaveURL(/\/reminders\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E Netflix");
  await expect(page.getByText("2 300 Ft").first()).toBeVisible();

  const { data: reminder } = await db.client.from("reminders").select("*").eq("name", "E2E Netflix").single();
  expect(reminder).toMatchObject({ amount: 2300, currency: "HUF", recur_unit: "month", recur_every: 1, start_date: start, remind_offsets: [1] });
  const { data: occurrences } = await db.client.from("occurrences").select("due_date, status").eq("reminder_id", reminder!.id).order("due_date");
  expect(occurrences!.length).toBeGreaterThanOrEqual(4); // 120 napra előre generálva
  expect(occurrences![0]).toMatchObject({ due_date: start, status: "upcoming" });
});

test("új emlékeztető: múltbeli első esedékesség hiba + javaslat, a „Beállítom” javít", async ({ page }) => {
  const today = todayIn("Europe/Budapest");
  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("E2E Múlt");
  await page.getByLabel("Összeg").fill("1000");
  await page.getByLabel("Első esedékesség").fill(addDays(today, -40));

  await expect(page.getByText("Az első esedékesség már elmúlt.")).toBeVisible();
  await page.getByRole("button", { name: "Beállítom" }).click();
  await expect(page.getByLabel("Első esedékesség")).not.toHaveValue(addDays(today, -40));
  await expect(page.getByText("Az első esedékesség már elmúlt.")).toBeHidden();
});

test("érvénytelen adat: mező-hibák, a fókusz az elsőre ugrik, nincs mentés", async ({ page }) => {
  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("x");
  await page.getByLabel("Összeg").fill("-5");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Az összeg nem lehet negatív.")).toBeVisible();
  await expect(page.getByLabel("Összeg")).toBeFocused();
  expect((await db.client.from("reminders").select("id").eq("name", "x")).data).toEqual([]);
});

test("szerkesztés: az összeg módosul; a katalógus-javaslat kitölti a nevet", async ({ page }) => {
  const { data: reminder } = await db.client.from("reminders").select("id").eq("name", "E2E Netflix").single();
  await page.goto(`/reminders/${reminder!.id}/edit`);
  await expect(page.getByLabel("Név")).toHaveValue("E2E Netflix");
  await page.getByLabel("Összeg").fill("2600");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(new RegExp(`/reminders/${reminder!.id}$`));
  await expect.poll(async () => (await db.client.from("reminders").select("amount").eq("id", reminder!.id).single()).data!.amount).toBe(2600);

  // katalógus-javaslat (combobox)
  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("spot");
  await page.getByRole("option", { name: "Spotify" }).click();
  await expect(page.getByLabel("Név")).toHaveValue("Spotify");
});

test("törlés megerősítéssel: a részletoldalról a listára vissza, a sor törlődik", async ({ page }) => {
  const { data: reminder } = await db.client.from("reminders").select("id").eq("name", "E2E Netflix").single();
  await page.goto(`/reminders/${reminder!.id}`);
  await page.getByRole("button", { name: /^Műveletek: / }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Törlés" }).click();
  const confirm = page.getByRole("dialog", { name: "Törlöd az emlékeztetőt?" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Törlés" }).click();

  await expect(page).toHaveURL(/\/reminders$/);
  expect((await db.client.from("reminders").select("id").eq("id", reminder!.id)).data).toEqual([]);
  expect((await db.client.from("occurrences").select("id").eq("reminder_id", reminder!.id)).data).toEqual([]); // kaszkád
});

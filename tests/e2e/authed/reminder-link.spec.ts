import { expect, test } from "@playwright/test";
import { addDays } from "../../../lib/tz";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// A-48 kérés: a `reminders.url` jól látható mező az űrlapon, és „Megnyitás ↗" gomb a Főoldal „Hamarosan esedékes" soraiban,
// a listán és a részleten (csak http/https, új lapon, noopener noreferrer). Az emlékeztetőket DB-ből hozzuk létre (gyors, determinisztikus).
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
let reminderId: string;
const NAME = "E2E Claude-előfizetés";
const URL_OK = "https://claude.ai/upgrade";

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
  const today = (await db.client.rpc("user_today")).data as string;
  const { data, error } = await db.client
    .from("reminders")
    .insert({ name: NAME, amount: 7000, currency: "HUF", start_date: addDays(today, 2), recur_unit: "month", recur_every: 1, remind_offsets: [1], remind_time: "09:00:00", url: URL_OK })
    .select("id")
    .single();
  if (error || !data) throw new Error("a teszt-emlékeztető létrehozása sikertelen");
  reminderId = data.id;
  await db.client.from("reminders").insert({ name: "E2E Link nélkül", amount: 1000, currency: "HUF", start_date: addDays(today, 3), recur_unit: "month", recur_every: 1, remind_offsets: [1], remind_time: "09:00:00" });
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

const OPEN = new RegExp(`${NAME} megnyitása új lapon \\(claude\\.ai\\)`);

test("az űrlapon a Link mező azonnal látszik (nem a „Továbbiak” alatt), mellette a Bank-egyeztetés kulcsszó", async ({ page }) => {
  await page.goto("/reminders/new");
  await expect(page.getByLabel("Link")).toBeVisible();
  await expect(page.getByLabel(/Bank-egyeztetés kulcsszó/)).toBeVisible();
  await expect(page.getByText("„Megnyitás” gomb lesz belőle", { exact: false })).toBeVisible();
});

test("veszélyes link (javascript:) az űrlapon elutasítva, nincs mentés", async ({ page }) => {
  await page.goto("/reminders/new");
  await page.getByLabel("Név").fill("E2E Veszélyes");
  await page.getByLabel("Összeg").fill("1000");
  await page.getByLabel("Link").fill("javascript:alert(1)");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("A link http:// vagy https:// címmel kezdődjön.")).toBeVisible();
  expect((await db.client.from("reminders").select("id").eq("name", "E2E Veszélyes")).data).toEqual([]);
});

test("a link a mentés után a listán, a Főoldalon és a részleten is „Megnyitás”, biztonságos attribútumokkal", async ({ page }) => {
  for (const url of ["/reminders", "/dashboard", `/reminders/${reminderId}`]) {
    await page.goto(url);
    const link = page.getByRole("link", { name: OPEN }).first();
    await expect(link, url).toBeVisible();
    await expect(link).toHaveAttribute("href", URL_OK);
    await expect(link).toHaveAttribute("target", "_blank");
    expect(await link.getAttribute("rel")).toMatch(/noopener/);
    expect(await link.getAttribute("rel")).toMatch(/noreferrer/);
  }
});

test("link nélküli emlékeztetőn nincs „Megnyitás”", async ({ page }) => {
  await page.goto("/reminders");
  const plain = page.getByRole("listitem").filter({ hasText: "E2E Link nélkül" }).first();
  await expect(plain).toBeVisible();
  await expect(plain.getByRole("link", { name: /megnyitása új lapon/ })).toHaveCount(0);
});

test("mélységi védelem: az adatbázis maga is elutasítja a nem http(s) hivatkozást (javascript:, data:, relatív)", async () => {
  // a séma az űrlapon, a CHECK-megszorítás a DB-ben védi; a felület ráadásul a safeExternalUrl-lel is szűr (unit-teszt)
  const today = (await db.client.rpc("user_today")).data as string;
  for (const url of ["javascript:alert(1)", "data:text/html,x", "/relativ", "ftp://example.com"]) {
    const { error, data } = await db.client
      .from("reminders")
      .insert({ name: "E2E Rossz link", amount: 500, currency: "HUF", start_date: addDays(today, 4), recur_unit: "month", recur_every: 1, remind_offsets: [1], remind_time: "09:00:00", url })
      .select("id");
    expect(error, url).not.toBeNull();
    expect(data ?? [], url).toEqual([]);
  }
});

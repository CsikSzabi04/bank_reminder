import { expect, test } from "@playwright/test";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

let db: Awaited<ReturnType<typeof userClient>>;
test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
  await db.client.rpc("load_demo_data");
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

test("naptár: hónap-rács, a napok linkek, a kiválasztott nap tételei listázva", async ({ page }) => {
  await page.goto("/calendar");
  await expect(page.getByRole("heading", { level: 1, name: "Naptár" })).toBeVisible();
  const grid = page.getByRole("region", { name: "Hónap naptára" });
  await expect(grid.getByRole("link")).not.toHaveCount(0);
  // van olyan nap, amelyiken tétel van → rákattintva megjelenik a lista
  const withItems = grid.getByRole("link", { name: /, [1-9]\d* tétel$/ }).first();
  await withItems.click();
  await expect(page).toHaveURL(/day=\d{4}-\d{2}-\d{2}/);
  await expect(page.getByRole("list", { name: /\d{4}/ }).getByRole("listitem").first()).toBeVisible();
});

test("naptár-feed: érvényes text/calendar, a minta-tételekkel; érvénytelen token 404", async ({ page, request }) => {
  await page.goto("/calendar");
  const url = await page.getByRole("textbox", { name: "Naptár-link" }).inputValue();
  expect(url).toMatch(/\/api\/ics\/[0-9a-f]{64}\.ics$/);

  const res = await request.get(url);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/calendar");
  const body = await res.text();
  expect(body).toContain("BEGIN:VCALENDAR");
  expect(body).toContain("BEGIN:VEVENT");
  expect(body).toContain("Netflix");
  expect(body).not.toMatch(/[^\r]\n/);

  expect((await request.get("/api/ics/rovid.ics")).status()).toBe(404);
  // ismeretlen, de formailag érvényes token: üres (de érvényes) naptár, nem szivárog semmit
  const unknown = await request.get(`/api/ics/${"a".repeat(64)}.ics`);
  expect(unknown.status()).toBe(200);
  expect(await unknown.text()).not.toContain("VEVENT");
});

test("új naptár-link: a régi azonnal érvénytelen (üres feed), az új működik", async ({ page, request }) => {
  await page.goto("/calendar");
  const oldUrl = await page.getByRole("textbox", { name: "Naptár-link" }).inputValue();
  await page.getByRole("button", { name: "Új naptár-link" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Új naptár-link" }).click();
  await expect(page.getByText("Új naptár-link kész.")).toBeVisible();
  await expect.poll(async () => page.getByRole("textbox", { name: "Naptár-link" }).inputValue()).not.toBe(oldUrl);

  expect(await (await request.get(oldUrl)).text()).not.toContain("VEVENT");
  const newUrl = await page.getByRole("textbox", { name: "Naptár-link" }).inputValue();
  expect(await (await request.get(newUrl)).text()).toContain("VEVENT");
});

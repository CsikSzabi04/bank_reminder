import { expect, test } from "@playwright/test";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";
import { overflowingElements } from "../support/layout";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// Nincs vízszintes görgetés (és nincs kilógó elem) a bejelentkezett oldalakon 360 / 768 / 1280 px-en (§14.3, §22.3)
let reminderId: string;
let db: Awaited<ReturnType<typeof userClient>>;

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
  await db.client.rpc("load_demo_data");
  reminderId = (await db.client.from("reminders").select("id").eq("name", "Netflix").single()).data!.id;
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

const SIZES = [
  { width: 360, height: 740 },
  { width: 768, height: 900 },
  { width: 1280, height: 800 },
];
const PAGES: [string, () => string][] = [
  ["Főoldal", () => "/dashboard"],
  ["Emlékeztetők", () => "/reminders"],
  ["Új emlékeztető", () => "/reminders/new"],
  ["Szerkesztés", () => `/reminders/${reminderId}/edit`],
  ["Részletek", () => `/reminders/${reminderId}`],
  ["Naptár", () => "/calendar"],
  ["Analitika", () => "/analytics"],
  ["Analitika · táblázat", () => "/analytics?view=table&range=12m"],
  ["Értesítések", () => "/notifications"],
  ["Profil · Értesítések", () => "/profile?section=notifications"],
  ["Profil", () => "/profile"],
  ["Profil · Biztonság", () => "/profile?section=security"],
];

for (const { width, height } of SIZES) {
  for (const [name, url] of PAGES) {
    test(`${name} @${width}px: nincs vízszintes túlcsordulás`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto(url());
      await expect(page.locator("main")).toBeVisible();
      expect(await overflowingElements(page)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
    });
  }
}

import { expect, test } from "@playwright/test";
import { cleanBudget, cleanGoals, hasE2eAccount, purgeReminders, seedBudget, seedGoal, userClient } from "../support/db";
import { overflowingElements } from "../support/layout";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// Nincs vízszintes görgetés (és nincs kilógó elem) a bejelentkezett oldalakon 360 / 768 / 1280 px-en (§14.3, §22.3)
let reminderId: string;
let categoryId: string;
let goalId: string;
let newsId: string;
let db: Awaited<ReturnType<typeof userClient>>;

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
  await db.client.rpc("load_demo_data");
  categoryId = await seedBudget(db.client);
  goalId = await seedGoal(db.client);
  await db.client.rpc("refresh_tips");
  newsId = ((await db.client.rpc("news_feed", { p_limit: 1 })).data ?? [])[0]?.id ?? "00000000-0000-4000-8000-000000000000";
  reminderId = (await db.client.from("reminders").select("id").eq("name", "Netflix").single()).data!.id;
});
test.afterAll(async () => {
  await cleanBudget(db.client, categoryId);
  await cleanGoals(db.client);
  await purgeReminders(db.client);
});

// a 320 px a 200%-os nagyítás megfelelője 640 px-es ablakon (WCAG 1.4.10 reflow): itt sem lehet vízszintes görgetés
const SIZES = [
  { width: 320, height: 640 },
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
  ["Keretek", () => "/budgets"],
  ["Keret-részlet", () => `/budgets/${categoryId}`],
  ["Tippek", () => "/tips"],
  ["Hírek", () => "/news"],
  ["Hír részletei", () => `/news/${newsId}`],
  ["Bank-összekötés", () => "/bank"],
  ["Bank · Összekötés", () => "/bank?section=overview"],
  ["Bank · Tranzakciók", () => "/bank?section=transactions"],
  ["Bank · Android", () => "/bank?section=android"],
  ["Bank · Szabályok", () => "/bank?section=rules"],
  ["Bank · Összekötés hibaüzenettel", () => "/bank?section=overview&result=error&reason=state_invalid"],
  ["Megtakarítás", () => "/savings"],
  ["Új cél", () => "/savings/new?preset=vacation"],
  ["Cél részletei", () => `/savings/${goalId}`],
  ["Cél szerkesztése", () => `/savings/${goalId}/edit`],
  ["Analitika · táblázat", () => "/analytics?view=table&range=12m"],
  ["Értesítések", () => "/notifications"],
  ["Profil · Értesítések", () => "/profile?section=notifications"],
  ["Profil", () => "/profile"],
  ["Profil · Biztonság", () => "/profile?section=security"],
  ["Profil · Pénzügyek", () => "/profile?section=finance"],
  ["Profil · Adataim", () => "/profile?section=data"],
  ["Profil · Névjegy", () => "/profile?section=about"],
  ["Profil · Megjelenés", () => "/profile?section=appearance"],
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

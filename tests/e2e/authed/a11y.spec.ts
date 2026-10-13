import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// Automata hozzáférhetőségi ellenőrzés a bejelentkezett oldalakon: 0 serious/critical axe-hiba (§14.14, B-29 előzetes)
let db: Awaited<ReturnType<typeof userClient>>;
let reminderId: string;

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
  await db.client.rpc("load_demo_data");
  reminderId = (await db.client.from("reminders").select("id").eq("name", "Netflix").single()).data!.id;
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

async function serious(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} (${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")})`);
}

const PAGES: [string, () => string][] = [
  ["Főoldal", () => "/dashboard"],
  ["Emlékeztető-lista", () => "/reminders"],
  ["Emlékeztető-lista (szűrt, keresett)", () => "/reminders?filter=subscriptions&q=net"],
  ["Új emlékeztető", () => "/reminders/new"],
  ["Emlékeztető szerkesztése", () => `/reminders/${reminderId}/edit`],
  ["Emlékeztető részletei", () => `/reminders/${reminderId}`],
  ["Profil", () => "/profile"],
  ["Profil · Megjelenés", () => "/profile?section=appearance"],
  ["Profil · Biztonság", () => "/profile?section=security"],
  ["404", () => "/reminders/00000000-0000-4000-8000-000000000000"],
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(scheme, () => {
    test.use({ colorScheme: scheme });
    for (const [name, url] of PAGES) {
      test(`${name}: nincs serious/critical axe-hiba`, async ({ page }) => {
        await page.goto(url());
        await expect(page.locator("main")).toBeVisible();
        // a témát a next-themes a rendszer-beállításból veszi; megvárjuk a hidratálást
        await page.waitForFunction(() => !!sessionStorage.getItem("br_profile_synced"));
        expect(await serious(page)).toEqual([]);
      });
    }
  });
}

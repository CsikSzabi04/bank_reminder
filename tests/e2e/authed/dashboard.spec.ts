import { expect, test } from "@playwright/test";
import type { DashboardSummary } from "../../../types/rpc";
import { formatMoney, formatPercent, todayIn } from "../../../lib/format";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";
import { overflowingElements } from "../support/layout";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-14: a dashboard számai az A-oldali dashboard_summary RPC értékeivel egyeznek (az SQL számol, a UI csak formáz)
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
const monthStart = `${todayIn("Europe/Budapest").slice(0, 7)}-01`;

const summary = async () =>
  (await db.client.rpc("dashboard_summary", { p_month: monthStart })).data as unknown as DashboardSummary;
const hu = (n: number, currency = "HUF") => formatMoney(n, currency, "hu");

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

test("üres fiók: üdvözlő üres állapot, minta-adat gombbal", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Üdv a Bank Reminderben!" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Új emlékeztető" }).first()).toBeVisible();
  await page.getByRole("button", { name: "Minta-adatok betöltése" }).click();
  await expect(page.getByRole("heading", { name: "Havi kiadás" })).toBeVisible();
});

test("hero: a havi összeg, a kifizetve/hátravan és a fánk-jelmagyarázat az RPC-vel egyezik", async ({ page }) => {
  const s = await summary();
  await page.goto("/dashboard");

  const hero = page.getByRole("region", { name: "Havi kiadás" });
  await expect(hero).toContainText(hu(s.hero.total));
  await expect(hero.getByText("Kifizetve").locator("..")).toContainText(hu(s.hero.paid));
  await expect(hero.getByText("Hátravan").locator("..")).toContainText(hu(s.hero.remaining));

  // a jelmagyarázat: minden csoport neve + összege + aránya
  const total = s.groups.reduce((sum, g) => sum + g.total, 0);
  for (const g of s.groups.filter((x) => x.total > 0)) {
    const legendRow = hero.getByRole("listitem").filter({ hasText: hu(g.total) });
    await expect(legendRow.first()).toContainText(formatPercent(g.total / total, "hu"));
  }

  // a fánk összegző aria-label-je minden csoportot felsorol (nem csak szín hordozza az információt)
  const label = await hero.getByRole("img").first().getAttribute("aria-label");
  expect(label).toContain("Kiadás kategória-csoportonként");
  for (const g of s.groups.filter((x) => x.total > 0)) expect(label).toContain(hu(g.total));
});

test("Hamarosan esedékes: a következő tételek az RPC sorrendjében; a „Kifizettem” a dashboardot is frissíti", async ({ page }) => {
  const before = await summary();
  await page.goto("/dashboard");

  const list = page.getByRole("list", { name: "Hamarosan esedékes" });
  const rows = list.getByRole("listitem");
  await expect(rows).toHaveCount(before.upcoming.length);
  await expect(rows.first()).toContainText(before.upcoming[0].name);
  await expect(rows.first()).toContainText(hu(before.upcoming[0].amount, before.upcoming[0].currency));

  await rows.first().getByRole("button", { name: /kifizetettnek jelölése/ }).click();
  await expect.poll(async () => (await summary()).hero.paid).toBeGreaterThan(before.hero.paid);

  // a szerver-oldali újrarenderelés után a hero „Kifizetve" sora az új RPC-értéket mutatja
  const after = await summary();
  await expect(page.getByRole("region", { name: "Havi kiadás" }).getByText("Kifizetve").locator("..")).toContainText(hu(after.hero.paid));
});

test("előfizetések kártya: havi összeg és „évente …” az RPC-vel egyezik", async ({ page }) => {
  const s = await summary();
  await page.goto("/dashboard");
  // a kártya és a benne lévő görgethető sáv is "Előfizetések" nevű régió → a szekciót a címsorával azonosítjuk
  const card = page.locator("section", { has: page.getByRole("heading", { name: "Előfizetések" }) });
  await expect(card).toContainText(`${hu(s.subscriptions.monthly_total)}/hó`);
  await expect(card).toContainText(`évente ${hu(s.subscriptions.yearly_total)}`);
  for (const item of s.subscriptions.items) await expect(card).toContainText(item.name);
});

test("hónap-váltó: előző/következő hónap az URL-ben él; érvénytelen érték az aktuális hónapra esik vissza", async ({ page }) => {
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Előző hónap" }).click();
  await expect(page).toHaveURL(/\/dashboard\?month=\d{4}-\d{2}$/);
  await expect(page.getByRole("heading", { name: "Havi kiadás" })).toBeVisible();

  await page.getByRole("link", { name: "Következő hónap" }).click();
  await expect(page).toHaveURL(/\/dashboard$/); // az aktuális hónap tiszta URL

  await page.goto("/dashboard?month=nem-honap");
  await expect(page.getByRole("heading", { name: "Havi kiadás" })).toBeVisible();
  await page.goto("/dashboard?month=1999-01"); // ±24 hónapon kívül
  await expect(page.getByRole("navigation", { name: "Hónap" })).toContainText(new RegExp(String(new Date().getFullYear())));
});

test("mobil nézet: nincs vízszintes görgetés, a fánk és a jelmagyarázat látszik", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Havi kiadás" })).toBeVisible();
  expect(await overflowingElements(page)).toEqual([]);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

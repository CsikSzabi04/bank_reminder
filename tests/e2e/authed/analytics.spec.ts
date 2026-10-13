import { expect, test } from "@playwright/test";
import { formatMoney, todayIn } from "../../../lib/format";
import type { DashboardSummary } from "../../../types/rpc";
import { hasE2eAccount, purgeReminders, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-21: az /analytics számai az SQL-lel (dashboard_summary, analytics_*) egyeznek; a diagramok és a táblázat-nézet ugyanazt mutatják
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
const monthStart = `${todayIn("Europe/Budapest").slice(0, 7)}-01`;
const hu = (n: number) => formatMoney(n, "HUF", "hu");
const CHARTS = ["Kategóriák", "Havi trend", "A hónap lefutása", "Top 5 tétel", "Kategóriák alakulása", "Következő 30 nap", "Előfizetések költsége"];

test.beforeAll(async () => {
  db = await userClient();
  await purgeReminders(db.client);
});
test.afterAll(async () => {
  await purgeReminders(db.client);
});

test("üres fiók: üres állapot minta-adat gombbal", async ({ page }) => {
  await page.goto("/analytics");
  await expect(page.getByRole("heading", { level: 1, name: "Analitika" })).toBeVisible();
  await expect(page.getByText("Még nincs mit elemezni")).toBeVisible();
  await expect(page.getByRole("button", { name: /Minta-adatok betöltése/ })).toBeVisible();
});

test("minta-adatokkal: KPI-k az SQL értékeivel, mind a 7 diagram, meglátások", async ({ page }) => {
  await db.client.rpc("load_demo_data");
  const s = (await db.client.rpc("dashboard_summary", { p_month: monthStart })).data as unknown as DashboardSummary;

  await page.goto("/analytics");
  const kpi = page.getByRole("list").filter({ hasText: "Kifizetve eddig" }).first();
  await expect(kpi).toContainText(hu(s.hero.total));
  await expect(kpi).toContainText(hu(s.hero.paid));
  await expect(kpi).toContainText(hu(s.hero.remaining));
  await expect(kpi).toContainText(hu(s.subscriptions.yearly_total));

  for (const name of CHARTS) await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
  // a diagramok SVG-jei képként, szöveges összegzéssel
  await expect(page.getByRole("img", { name: /^Kategóriák: / })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Havi kiadás hónaponként: / })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Lefutás / })).toBeVisible();
  // C7: „évente …" a nagy szám
  await expect(page.getByText(`évente ${hu(s.subscriptions.yearly_total)}`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Meglátások" })).toBeVisible();
});

test("táblázat-nézet: ugyanaz az adat <table>-ben, a diagram-képek eltűnnek", async ({ page }) => {
  await page.goto("/analytics");
  await page.getByRole("link", { name: "Táblázat" }).click();
  await expect(page).toHaveURL(/view=table/);
  await expect(page.getByRole("link", { name: "Táblázat" })).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("img", { name: /^Havi kiadás hónaponként/ })).toHaveCount(0);
  const tables = page.getByRole("table");
  await expect(tables.first()).toBeVisible();
  expect(await tables.count()).toBeGreaterThanOrEqual(5);
  // C1 táblázat: a csoportok összege = a dashboard összesen
  const s = (await db.client.rpc("dashboard_summary", { p_month: monthStart })).data as unknown as DashboardSummary;
  const c1 = page.getByRole("table", { name: "Kategóriák", exact: true });
  await expect(c1).toContainText(hu(s.groups[0].total));
});

test("időszak-chip: a választás az URL-ben él, a hónap-váltó megtartja", async ({ page }) => {
  await page.goto("/analytics");
  await page.getByRole("link", { name: "6 hó" }).click();
  await expect(page).toHaveURL(/range=6m/);
  await expect(page.getByRole("link", { name: "6 hó" })).toHaveAttribute("aria-current", "true");
  await page.getByRole("link", { name: "Előző hónap" }).click();
  await expect(page).toHaveURL(/range=6m/);
  await expect(page).toHaveURL(/month=\d{4}-\d{2}/);
  // érvénytelen paraméter → biztonságos alapértelmezés, nem hiba
  await page.goto("/analytics?range=evil&view=x&month=nem-datum");
  await expect(page.getByRole("link", { name: "Hónap", exact: true }).first()).toHaveAttribute("aria-current", "true");
  await expect(page.getByRole("heading", { level: 2, name: "Havi trend" })).toBeVisible();
});

test("következő 30 nap: a tételes nap link a naptárra", async ({ page }) => {
  await page.goto("/analytics");
  const day = page.getByRole("list", { name: "Következő 30 nap" }).getByRole("link").first();
  await expect(day).toHaveAttribute("href", /\/calendar\?month=\d{4}-\d{2}&day=\d{4}-\d{2}-\d{2}/);
  await day.click();
  await expect(page).toHaveURL(/\/calendar\?month=/);
  await expect(page.getByRole("heading", { level: 1, name: "Naptár" })).toBeVisible();
});

test("angol nyelv: a feliratok és a tengely-jelmagyarázat is angolul", async ({ page }) => {
  await db.client.from("profiles").update({ locale: "en" }).eq("id", db.userId);
  try {
    await page.goto("/analytics");
    await expect(page.getByRole("heading", { level: 1, name: "Analytics" })).toBeVisible();
    for (const name of ["Categories", "Monthly trend", "How the month unfolds", "Top 5 items", "Next 30 days", "Subscription costs"]) {
      await expect(page.getByRole("heading", { level: 2, name, exact: true })).toBeVisible();
    }
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
  } finally {
    await db.client.from("profiles").update({ locale: "hu" }).eq("id", db.userId);
  }
});

import { expect, test } from "@playwright/test";
import { formatMoney } from "../../../lib/format";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-22: költségkeret + gyors kiadás élő adaton; az összegeket az SQL (budget_status) adja, a UI csak formáz.
// Csak a saját, jelölt sorait takarítja (kategória / jegyzet szerint).
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
let category: { id: string; name: string };
const MARK = "e2e-kiadás";
const hu = (n: number) => formatMoney(n, "HUF", "hu");

async function clean() {
  await db.client.from("expenses").delete().eq("note", MARK);
  await db.client.from("budgets").delete().eq("category_id", category.id);
}

test.beforeAll(async () => {
  db = await userClient();
  const { data } = await db.client.from("categories").select("id, name_hu").in("kind", ["expense", "both"]).order("sort").limit(1).single();
  if (!data) throw new Error("nincs kiadás-kategória");
  category = { id: data.id, name: data.name_hu ?? "" };
  await clean();
});
test.afterAll(async () => {
  await clean();
});

test("keret létrehozása: a kategória-chipből, mentés után a listában és az SQL-ben", async ({ page }) => {
  await page.goto("/budgets");
  await expect(page.getByRole("heading", { level: 1, name: "Költségkeretek" })).toBeVisible();
  await expect(page.getByText("Még nincs kerete")).toBeVisible();
  await page.getByRole("link", { name: new RegExp(category.name) }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: category.name })).toBeVisible();

  // érvénytelen összeg: mezőhiba, nem ment
  await page.getByLabel("Havi keret").fill("abc");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Adj meg érvényes összeget")).toBeVisible();

  await page.getByLabel("Havi keret").fill("50 000");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(/\/budgets$/);
  await expect(page.getByText("Mennyit költhetsz még?")).toBeVisible();
  await expect(page.getByRole("progressbar", { name: category.name })).toBeVisible();

  const { data } = await db.client.from("budgets").select("monthly_limit").eq("category_id", category.id).single();
  expect(data?.monthly_limit).toBe(50000);
});

test("gyors kiadás: rögzítés után a keret elköltött összege az SQL-lel egyezik, a toastról visszavonható", async ({ page }) => {
  await page.goto("/budgets");
  await page.getByRole("button", { name: "Gyors kiadás" }).click();
  const sheet = page.getByRole("dialog", { name: "Gyors kiadás" });
  await sheet.getByLabel("Összeg").fill("12 500");
  await sheet.getByText(category.name, { exact: true }).click();
  await sheet.getByLabel(/Megjegyzés/).fill(MARK);
  await sheet.getByRole("button", { name: "Rögzítés" }).click();
  await expect(page.getByText("Kiadás rögzítve.")).toBeVisible();

  const status = (await db.client.rpc("budget_status", {})).data!.find((r) => r.category_id === category.id)!;
  expect(status.spent).toBe(12500);
  await expect(page.getByText(`${hu(12500)} elköltve / ${hu(50000)} keret`)).toBeVisible();
  await expect(page.getByText(hu(status.left - status.committed)).first()).toBeVisible();

  // visszavonás a toastról
  await page.getByRole("button", { name: "Visszavonás" }).click();
  await expect.poll(async () => (await db.client.from("expenses").select("id").eq("note", MARK)).data?.length).toBe(0);
});

test("túllépés: piros állapot szöveggel és a hátralévő összeg negatív jelzéssel", async ({ page }) => {
  await page.goto("/budgets?add=expense");
  const sheet = page.getByRole("dialog", { name: "Gyors kiadás" });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel("Összeg").fill("60000");
  await sheet.getByText(category.name, { exact: true }).click();
  await sheet.getByLabel(/Megjegyzés/).fill(MARK);
  await sheet.getByRole("button", { name: "Rögzítés" }).click();
  await expect(page).toHaveURL(/\/budgets$/); // a ?add=expense eltűnik
  await expect(page.getByText(/túllépés/).first()).toBeVisible();
});

test("kategória-részlet: a kiadás listázva, törölhető; a keret szerkeszthető, majd törölhető megerősítéssel", async ({ page }) => {
  await page.goto(`/budgets/${category.id}`);
  const item = page.getByRole("listitem").filter({ hasText: hu(60000) });
  await expect(item).toBeVisible();
  await item.getByRole("button", { name: /törlése/ }).click();
  await expect(page.getByText("A kiadás törölve.")).toBeVisible();
  await expect(page.getByText(hu(60000))).toHaveCount(0);

  await page.getByLabel("Havi keret").fill("70000");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(/\/budgets$/);
  expect((await db.client.from("budgets").select("monthly_limit").eq("category_id", category.id).single()).data?.monthly_limit).toBe(70000);

  await page.goto(`/budgets/${category.id}`);
  await page.getByRole("button", { name: "Keret törlése" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Keret törlése" }).click();
  await expect(page).toHaveURL(/\/budgets$/);
  expect((await db.client.from("budgets").select("id").eq("category_id", category.id)).data).toEqual([]);
});

test("érvénytelen kategória-azonosító → 404", async ({ page }) => {
  await page.goto("/budgets/nem-uuid");
  await expect(page.getByRole("heading", { name: "Nem találjuk az oldalt" })).toBeVisible();
});

test("mobil: a + gomb menüt nyit, a Gyors kiadás a keretek lapot nyitja nyitott lappal", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Hozzáadás" }).click();
  await expect(page.getByRole("link", { name: "Gyors kiadás" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Gyors kiadás" })).toHaveCount(0);
  await page.getByRole("button", { name: "Hozzáadás" }).click();
  await page.getByRole("link", { name: "Gyors kiadás" }).click();
  await expect(page).toHaveURL(/\/budgets\?add=expense/);
  await expect(page.getByRole("dialog", { name: "Gyors kiadás" })).toBeVisible();
});

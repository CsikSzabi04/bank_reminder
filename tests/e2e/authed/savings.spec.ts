import { expect, test } from "@playwright/test";
import { formatMoney } from "../../../lib/format";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-23: megtakarítási célok élő adaton; a haladást (összegyűlt, %, havi szükséges) a savings_goals_progress view adja.
// Csak a jelölt nevű célokat takarítja (a kapcsolódó befizetések kaszkáddal törlődnek).
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
const NAME = "E2E Nyaralás-cél";
const hu = (n: number) => formatMoney(n, "HUF", "hu");

async function clean() {
  await db.client.from("savings_goals").delete().like("name", "E2E %");
  // egy megszakadt korábbi futás előkészített neve is takarítandó (a teszt-fiók csak e2e-re van)
  await db.client.from("savings_goals").delete().in("name", ["Nyaralás", "Vészhelyzeti alap", "Új telefon"]);
}
const progress = async () => (await db.client.from("savings_goals_progress").select("*").eq("name", NAME).single()).data!;

test.beforeAll(async () => {
  db = await userClient();
  await clean();
});
test.afterAll(async () => {
  await clean();
});

test("üres állapot: előkészített célok linkjei", async ({ page }) => {
  await page.goto("/savings");
  await expect(page.getByRole("heading", { level: 1, name: "Megtakarítás" })).toBeVisible();
  await expect(page.getByText("Még nincs megtakarítási célod")).toBeVisible();
  for (const name of ["Vészhelyzeti alap", "Nyaralás", "Új telefon", "Egyéni cél"]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible();
  }
});

test("előkészített cél: a Nyaralás kitölti a nevet; mentés után a részletoldalon vagyunk", async ({ page }) => {
  await page.goto("/savings/new?preset=vacation");
  await expect(page.getByLabel("Cél neve")).toHaveValue("Nyaralás");
  // érvénytelen / hiányzó adatok: mezőhibák
  await page.getByLabel("Cél neve").fill(NAME);
  await page.getByLabel("Célösszeg").fill("x");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Adj meg érvényes összeget")).toBeVisible();
  // hibás beküldés után a beírt értékek megmaradnak (nem állnak vissza az alapértékre)
  await expect(page.getByLabel("Cél neve")).toHaveValue(NAME);
  await expect(page.getByLabel("Célösszeg")).toHaveValue("x");

  await page.getByLabel("Célösszeg").fill("300 000");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page).toHaveURL(/\/savings\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("progressbar", { name: NAME })).toBeVisible();
  const p = await progress();
  expect(p.target_amount).toBe(300000);
  expect(p.icon).toBe("plane");
});

test("befizetés és kivét: az összegyűlt és a % az SQL-lel egyezik; túl nagy kivét elutasítva", async ({ page }) => {
  const { id } = await progress();
  await page.goto(`/savings/${id}`);

  await page.getByRole("button", { name: "Hozzáadás" }).click();
  let sheet = page.getByRole("dialog", { name: /Hozzáadás/ });
  await sheet.getByLabel("Összeg").fill("75 000");
  await sheet.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Hozzáadva.")).toBeVisible();

  let p = await progress();
  expect(p.saved).toBe(75000);
  expect(p.pct).toBe(25);
  await expect(page.getByText(`${hu(75000)} / ${hu(300000)}`)).toBeVisible();

  await page.getByRole("button", { name: "Kivét" }).click();
  sheet = page.getByRole("dialog", { name: /Kivét/ });
  await sheet.getByLabel("Összeg").fill("100 000");
  await sheet.getByRole("button", { name: "Mentés" }).click();
  await expect(sheet.getByText("Ennél többet nem vehetsz ki.")).toBeVisible();
  await sheet.getByLabel("Összeg").fill("25 000");
  await sheet.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Kivéve.")).toBeVisible();

  p = await progress();
  expect(p.saved).toBe(50000);
  await expect(page.getByRole("list").filter({ hasText: "Befizetés" }).getByRole("listitem")).toHaveCount(2);
});

test("előzmény törlése újraszámolja az összegyűltet; elérve: „Elérted a célt!”", async ({ page }) => {
  const { id } = await progress();
  await page.goto(`/savings/${id}`);
  await page.getByRole("button", { name: /Tétel törlése/ }).first().click();
  await expect(page.getByText("A tétel törölve.")).toBeVisible();
  expect((await progress()).saved).toBeLessThanOrEqual(75000);

  // célhoz érés: a cél összegét az összegyűltre csökkentve
  await page.goto(`/savings/${id}/edit`);
  await page.getByLabel("Célösszeg").fill("40000");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Elérted a célt!")).toBeVisible();
  expect((await progress()).reached).toBe(true);
});

test("archiválás: eltűnik az aktívak közül, az archiváltak közt megvan, visszaállítható", async ({ page }) => {
  const { id } = await progress();
  await page.goto(`/savings/${id}`);
  await page.getByRole("button", { name: "Archiválás" }).click();
  await expect(page).toHaveURL(/\/savings$/);
  await expect(page.getByText(NAME)).toHaveCount(0);

  await page.goto("/savings?archived=1");
  await expect(page.getByRole("link", { name: NAME })).toBeVisible();
  await page.getByRole("link", { name: NAME }).click();
  await page.getByRole("button", { name: "Visszaállítás" }).click();
  await expect(page.getByRole("button", { name: "Archiválás" })).toBeVisible();
});

test("vészhelyzeti alap előkészítés és érvénytelen azonosító", async ({ page }) => {
  await page.goto("/savings/new?preset=emergency");
  await expect(page.getByLabel("Cél neve")).toHaveValue("Vészhelyzeti alap");
  await expect(page.getByText(/Javasolt cél|kevés a kiadási adat/)).toBeVisible();

  await page.goto("/savings/nem-uuid");
  await expect(page.getByRole("heading", { name: "Nem találjuk az oldalt" })).toBeVisible();
});

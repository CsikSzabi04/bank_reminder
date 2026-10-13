import { expect, test } from "@playwright/test";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-25: hírek az élő `news_feed` / `news_get` RPC-ből (kiadói RSS, forrással és dátummal — H7). A hírekhez a kliensnek
// nincs közvetlen táblahozzáférése; a tesztek a tényleges betöltött tartalmat nézik (nem kitalált adatot).
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
let feedCount = 0;

test.beforeAll(async () => {
  db = await userClient();
  await db.client.from("profiles").update({ news_enabled: true }).eq("id", db.userId);
  feedCount = ((await db.client.rpc("news_feed", { p_limit: 12 })).data ?? []).length;
});
test.afterAll(async () => {
  await db.client.from("profiles").update({ news_enabled: true }).eq("id", db.userId);
});

test("hírlista: témaszűrők, kártyák forrással és életkorral, lusta kép referrer nélkül", async ({ page }) => {
  test.skip(feedCount === 0, "nincs betöltött hír az élő feedben");
  await page.goto("/news");
  await expect(page.getByRole("heading", { level: 1, name: "Hírek" })).toBeVisible();
  const chips = page.getByRole("region", { name: "Téma" });
  for (const name of ["Mind", "Akciók", "Árak", "Rezsi", "Bank és hitel", "Spórolás"]) await expect(chips.getByRole("link", { name, exact: true })).toBeVisible();
  await expect(chips.getByRole("link", { name: "Mind", exact: true })).toHaveAttribute("aria-current", "true");

  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  expect(await cards.count()).toBe(Math.min(feedCount, 12));
  // minden kártyán: forrás-név + életkor („… ezelőtt" / „tegnap" / „ma"), a kép lusta és referrer nélküli
  await expect(cards.first().getByText(/ezelőtt|tegnap|most/)).toBeVisible();
  const img = cards.first().locator("img").first();
  if (await img.count()) {
    await expect(img).toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("referrerpolicy", "no-referrer");
  }
  await expect(page.getByText(/a kiadók tulajdonai/)).toBeVisible();
});

test("témaszűrő: az állapot az URL-ben, a kártyák csak a témából", async ({ page }) => {
  test.skip(feedCount === 0, "nincs betöltött hír az élő feedben");
  await page.goto("/news");
  await page.getByRole("region", { name: "Téma" }).getByRole("link", { name: "Bank és hitel", exact: true }).click();
  await expect(page).toHaveURL(/topic=banking/);
  const articles = page.getByRole("article");
  if (await articles.count()) {
    for (const a of await articles.all()) await expect(a.getByText("Bank és hitel", { exact: true })).toBeVisible();
  } else {
    await expect(page.getByText("Most nincs friss hír")).toBeVisible();
  }
  // érvénytelen téma → nincs szűrő, nem hiba
  await page.goto("/news?topic=evil");
  await expect(page.getByRole("heading", { level: 1, name: "Hírek" })).toBeVisible();
});

test("Továbbiak: a következő lap hozzáadódik, nincs duplikátum", async ({ page }) => {
  test.skip(feedCount < 12, "egy lapnál kevesebb hír van");
  await page.goto("/news");
  const cards = page.getByRole("article");
  await expect(cards.first()).toBeVisible();
  const before = await cards.count();
  await page.getByRole("button", { name: "Továbbiak" }).click();
  await expect(cards).not.toHaveCount(before);
  const hrefs = await page.getByRole("article").getByRole("link").evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).getAttribute("href")));
  expect(new Set(hrefs).size).toBe(hrefs.length);
});

test("részletoldal: forrás, pontos dátum, eredeti cikk biztonságos linkkel, jelentés, jogi megjegyzés", async ({ page }) => {
  test.skip(feedCount === 0, "nincs betöltött hír az élő feedben");
  await page.goto("/news");
  await page.getByRole("article").first().getByRole("link").first().click();
  await expect(page).toHaveURL(/\/news\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/^Forrás: /)).toBeVisible();
  await expect(page.locator("time")).toHaveAttribute("datetime", /\d{4}-\d{2}-\d{2}T/);

  const original = page.getByRole("link", { name: /Eredeti cikk megnyitása/ });
  await expect(original).toHaveAttribute("target", "_blank");
  await expect(original).toHaveAttribute("rel", /noopener/);
  await expect(original).toHaveAttribute("rel", /noreferrer/);
  expect(await original.getAttribute("href")).toMatch(/^https:\/\//);
  await expect(page.getByText(/tulajdona; itt csak a címet és rövid kivonatot mutatjuk/)).toBeVisible();

  // „Hibásnak tűnik?" → ok-választás → köszönet (vagy: már jelentette ezt a hírt egy korábbi futásban)
  await page.getByRole("button", { name: "Hibásnak tűnik?" }).click();
  const sheet = page.getByRole("dialog", { name: "Mi a gond ezzel a hírrel?" });
  await sheet.getByLabel("Spam vagy hirdetés").check();
  await sheet.getByRole("button", { name: "Jelentés elküldése" }).click();
  await expect(page.getByText(/Köszönjük a jelzést\.|Ezt a hírt már jelentetted\./)).toBeVisible();
});

test("érvénytelen / ismeretlen azonosító → 404", async ({ page }) => {
  await page.goto("/news/nem-uuid");
  await expect(page.getByRole("heading", { name: "Nem találjuk az oldalt" })).toBeVisible();
  await page.goto("/news/00000000-0000-4000-8000-000000000000");
  await expect(page.getByRole("heading", { name: "Nem találjuk az oldalt" })).toBeVisible();
});

test("Főoldal: hír-sáv 3 kártyával; kikapcsolva a /news üres és a sáv eltűnik", async ({ page }) => {
  test.skip(feedCount === 0, "nincs betöltött hír az élő feedben");
  await page.goto("/dashboard");
  // a minta-adat nélküli fiók Főoldala üres állapotú (nincs hír-sáv); a sáv az adatos Főoldalon van → minta-adat kell
  await db.client.rpc("load_demo_data");
  try {
    await page.goto("/dashboard");
    const strip = page.getByRole("region", { name: "Hírek listája" });
    await expect(strip).toBeVisible();
    await expect(strip.getByRole("article")).toHaveCount(Math.min(3, feedCount));

    await page.goto("/news");
    await page.getByRole("button", { name: "Hírek kikapcsolása" }).click();
    await expect(page.getByText("A hírek ki vannak kapcsolva")).toBeVisible();
    expect((await db.client.from("profiles").select("news_enabled").eq("id", db.userId).single()).data?.news_enabled).toBe(false);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { level: 2, name: "Hírek" })).toHaveCount(0);

    await page.goto("/news");
    await page.getByRole("button", { name: "Hírek bekapcsolása" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Hírek" })).toBeVisible();
    await expect(page.getByText("A hírek ki vannak kapcsolva")).toHaveCount(0);
  } finally {
    await db.client.rpc("clear_demo_data");
  }
});

import { expect, test } from "@playwright/test";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");

// B-40 (/bank váz): navigáció, szakasz az URL-ben, `bank_sync_allowed`-függő megjelenítés.
// A teszt-fiók `bank_sync_allowed` értéke hamis (a kliens nem is állíthatja, ezért a „jogosult" ágat az
// A-41 utáni közös teszt, B-41 fedi) → itt a korlátozott megjelenést ellenőrizzük.
const SECTIONS = "Bank-oldal szakaszai";

test("asztalon az oldalsáv „Bank-összekötés” eleme a Keretek és a Megtakarítás között, aktívként jelölve", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bank");
  const primary = page.getByRole("navigation", { name: "Fő navigáció" });
  const names = await primary.getByRole("link").allTextContents();
  expect(names.indexOf("Bank-összekötés")).toBe(names.indexOf("Keretek") + 1);
  expect(names.indexOf("Megtakarítás")).toBe(names.indexOf("Bank-összekötés") + 1);
  await expect(primary.getByRole("link", { name: "Bank-összekötés" })).toHaveAttribute("aria-current", "page");
});

test("tableten az ikon-sínen elérhető (felirat az aria-labelben)", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Bank-összekötés" }).click();
  await expect(page).toHaveURL(/\/bank$/);
  await expect(page.getByRole("link", { name: "Bank-összekötés" })).toHaveAttribute("aria-current", "page");
});

test("mobilon a „Még” lapról érhető el", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Még" }).click();
  await page.getByRole("dialog", { name: "Még" }).getByRole("link", { name: "Bank-összekötés" }).click();
  await expect(page).toHaveURL(/\/bank$/);
  await expect(page.getByRole("heading", { level: 1, name: "Bank-összekötés" })).toBeVisible();
});

test("jogosultság nélkül (alapeset) az Android-szakasz a nyitó oldal, az összekötés csak magyarázat", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bank");
  const nav = page.getByRole("navigation", { name: SECTIONS });
  for (const name of ["Összekötés", "Android-értesítések", "Szabályok"]) {
    await expect(nav.getByRole("link", { name })).toBeVisible();
  }
  await expect(nav.getByRole("link", { name: "Android-értesítések" })).toHaveAttribute("aria-current", "page");

  await nav.getByRole("link", { name: "Összekötés" }).click();
  await expect(page).toHaveURL(/section=overview$/);
  await expect(nav.getByRole("link", { name: "Összekötés" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Ez a funkció jelenleg csak a fejlesztő saját számláira érhető el.")).toBeVisible();
  // nincs összekötés-gomb: az Enable-szakasz rejtett
  await expect(page.getByRole("button", { name: /Összekötés az Enable/ })).toHaveCount(0);
});

test("a szakasz az URL-ben él: frissítés után is megmarad, ismeretlen érték a nyitó szakaszra esik", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bank?section=rules");
  await page.reload();
  const nav = page.getByRole("navigation", { name: SECTIONS });
  await expect(nav.getByRole("link", { name: "Szabályok" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("heading", { level: 2, name: /Besorolásra vár/ })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Szabályaim" })).toBeVisible();


  await page.goto("/bank?section=nincs-ilyen");
  await expect(nav.getByRole("link", { name: "Android-értesítések" })).toHaveAttribute("aria-current", "page");
});

test("mobilon szakasz nélkül lista, szakasszal a részlet és a „Vissza” link", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/bank");
  const nav = page.getByRole("navigation", { name: SECTIONS });
  await expect(nav).toBeVisible();
  await expect(page.getByRole("link", { name: "Vissza a bank-oldalhoz" })).toBeHidden();

  await nav.getByRole("link", { name: "Android-értesítések" }).click();
  await expect(page).toHaveURL(/section=android$/);
  await expect(nav).toBeHidden();
  await page.getByRole("link", { name: "Vissza a bank-oldalhoz" }).click();
  await expect(nav).toBeVisible();
});

// B-41: a /bank/callback útvonal (az Enable-ben ez a regisztrált átirányítás). Itt csak azok az ágak futnak, amelyek
// a szervert nem hívják (a bank hibája, hibás paraméter) — a teljes folyamat az A-47 után, a Mock ASPSP-vel megy.
const STATE = "90b5c609-a1f5-4140-80e5-e4349b91b7cb";
const CODE = "ef69c617-c894-46bf-9186-4f9e4d522884";

test("callback: ha a bankban megtagadták, barátságos hiba jelenik meg, és az URL-ből eltűnik a state", async ({ page }) => {
  await page.goto(`/bank/callback?state=${STATE}&error=access_denied`);
  await expect(page).toHaveURL(/\/bank\?section=overview&result=error&reason=bank_denied$/);
  await expect(page.getByRole("alert").filter({ hasText: "nem hagytad jóvá a hozzáférést" })).toBeVisible();
  expect(page.url()).not.toContain(STATE);
});

test("callback: hiányzó vagy hibás paraméterrel nem jön létre semmi, érthető hiba látszik", async ({ page }) => {
  await page.goto(`/bank/callback?code=${CODE}`);
  await expect(page).toHaveURL(/reason=invalid_callback$/);
  await expect(page.getByRole("alert").filter({ hasText: "visszairányítása hibás volt" })).toBeVisible();

  await page.goto("/bank/callback?code=%3Cscript%3E&state=%3Cb%3E");
  await expect(page).toHaveURL(/reason=invalid_callback$/);
});

test("az URL-ből csak ismert visszajelzés olvasható ki, tetszőleges szöveg nem tükröződik vissza", async ({ page }) => {
  await page.goto("/bank?section=overview&result=error&reason=%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E");
  await expect(page.getByRole("alert").filter({ hasText: "Valami nem sikerült" })).toBeVisible();
  await expect(page.locator("main img[src='x']")).toHaveCount(0);

  await page.goto("/bank?section=overview&result=connected");
  await expect(page.getByRole("status").filter({ hasText: "Az összekötés sikerült" })).toBeVisible();
});

test("az összekötés-gomb jogosultság nélkül nem jelenik meg, az oldal nem hibázik a callback után sem", async ({ page }) => {
  await page.goto(`/bank/callback?state=${STATE}&error=server_error`);
  await expect(page.getByRole("button", { name: /Összekötés az Enable/ })).toHaveCount(0);
  await expect(page.getByText("Ez a funkció jelenleg csak a fejlesztő saját számláira érhető el.")).toBeVisible();
});

// B-44: kereskedő-szabályok CRUD az élő adatbázissal (a saját sorokon; az RLS a többit úgysem engedné).
// A „Besorolásra vár" tételeket a teszt-fiók nem tudja létrehozni (a főkönyvi sorokat csak szerver írja) → azt a unit-teszt (fake-db) fedi.
test.describe("kereskedő-szabályok (B-44)", () => {
  test.describe.configure({ mode: "serial" });
  let db: Awaited<ReturnType<typeof userClient>>;
  const KEY = "e2e teszt bolt";
  const clean = () => db.client.from("merchant_rules").delete().like("match_key", `${KEY}%`);

  test.beforeAll(async () => {
    db = await userClient();
    await clean();
  });
  test.afterAll(async () => {
    await clean();
  });

  test("új szabály → szerkesztés → duplikátum elutasítva → törlés megerősítéssel", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/bank?section=rules");
    await expect(page.getByText("Nincs besorolásra váró tétel.")).toBeVisible();

    // létrehozás: a kulcs ékezet- és kisbetű-független alakban mentődik
    await page.getByLabel("Kereskedő neve").fill("E2E Teszt Bolt");
    await page.getByLabel("Kategória", { exact: true }).selectOption({ index: 1 });
    await page.getByRole("button", { name: "Szabály hozzáadása" }).click();
    await expect(page.getByText("Szabály elmentve.")).toBeVisible();
    await expect.poll(async () => (await db.client.from("merchant_rules").select("match_key, user_id").eq("match_key", KEY)).data?.length).toBe(1);
    await expect(page.getByRole("button", { name: `A(z) ${KEY} szabály szerkesztése` })).toBeVisible();

    // ugyanaz a kulcs másodszor → barátságos hiba, nincs duplikátum
    await page.getByLabel("Kereskedő neve").fill("E2E TESZT bolt");
    await page.getByLabel("Kategória", { exact: true }).selectOption({ index: 2 });
    await page.getByRole("button", { name: "Szabály hozzáadása" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Erre a kereskedőre már van szabályod." })).toBeVisible();
    expect((await db.client.from("merchant_rules").select("id").eq("match_key", KEY)).data).toHaveLength(1);

    // szerkesztés
    await page.getByRole("button", { name: `A(z) ${KEY} szabály szerkesztése` }).click();
    await page.getByLabel("Kereskedő neve").first().fill("E2E Teszt Bolt 2");
    await page.getByRole("button", { name: "Mentés", exact: true }).click();
    await expect.poll(async () => (await db.client.from("merchant_rules").select("id").eq("match_key", `${KEY} 2`)).data?.length).toBe(1);

    // törlés megerősítéssel
    await page.getByRole("button", { name: `A(z) ${KEY} 2 szabály törlése` }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Törlés" }).click();
    await expect.poll(async () => (await db.client.from("merchant_rules").select("id").like("match_key", `${KEY}%`)).data?.length).toBe(0);
  });

  // A besorolás/elvetés atomi RPC-k (A-42) élnek az éles DB-n, az `authenticated` hívhatja, és a hibakódok a szerződés szerintiek.
  // Valódi tételt a teszt-fiók nem tud létrehozni (a főkönyvi sorokat csak a szerver írja) → az „ismeretlen tétel" ágat igazoljuk.
  test("az élő besorolás-RPC-k: ismeretlen tétel → BR404 (a függvények léteznek és hívhatók)", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    const category = (await db.client.from("categories").select("id").in("kind", ["expense", "both"]).limit(1).single()).data;
    expect(category).not.toBeNull();
    const classify = await db.client.rpc("classify_bank_transaction", { p_transaction: unknown, p_category: category!.id, p_remember: false });
    expect(classify.error?.code).toBe("BR404");
    const dismiss = await db.client.rpc("dismiss_bank_transaction", { p_transaction: unknown });
    expect(dismiss.error?.code).toBe("BR404");
  });

  test("mobilon a szabály-szakasz nem csordul túl, és a lista elérhető", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/bank?section=rules");
    await expect(page.getByRole("heading", { level: 2, name: "Szabályaim" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
});

// B-43: Android-szakasz. A szerver-oldal (A-43/A-44) telepítettségétől függetlenül helyes: nélküle „hamarosan" állapot,
// vele a token-kezelő felület; a natív app kártya mindkettőben ott van, és nincs vízszintes túlcsordulás.
test.describe("Android-szakasz (B-43)", () => {
  test("a szakasz hibamentesen betöltődik: „hamarosan” állapot VAGY a token-kezelő, mindkettőben a natív app kártya", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/bank?section=android");
    const comingSoon = page.getByRole("heading", { level: 2, name: "Android-értesítések — hamarosan" });
    const tokens = page.getByRole("heading", { level: 3, name: "Webhook-token" });
    await expect(comingSoon.or(tokens)).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: /Natív Android-app/ })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("mobilon sincs túlcsordulás", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/bank?section=android");
    await expect(page.getByRole("heading", { level: 3, name: /Natív Android-app/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });

  test.describe("iPhone", () => {
    test.use({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1" });
    test("az iOS-jelzés megjelenik (az iOS nem engedi az értesítés-olvasást)", async ({ page }) => {
      await page.goto("/bank?section=android");
      await expect(page.getByRole("note").filter({ hasText: "iPhone-on az iOS nem engedi" })).toBeVisible();
    });
  });

  test("asztali böngészőben nincs iOS-jelzés", async ({ page }) => {
    await page.goto("/bank?section=android");
    await expect(page.getByRole("heading", { level: 3, name: /Natív Android-app/ })).toBeVisible();
    await expect(page.getByRole("note")).toHaveCount(0);
  });
});


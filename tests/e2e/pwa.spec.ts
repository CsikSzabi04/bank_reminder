import { expect, test, type Page } from "@playwright/test";

// B-16/B-17 átvétele a PRODUCTION buildben (dev módban nincs service worker). Belépett session-nel fut.
test.skip(!process.env.E2E_EMAIL, "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

async function swReady(page: Page) {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // az első betöltést a SW még nem irányítja: egy újratöltés után már igen
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
}

// a PwaInit (effect) állítja a data-display-mode-ot: ha ez megvan, a beforeinstallprompt-figyelő is él
const hydrated = (page: Page) => page.waitForFunction(() => !!document.documentElement.dataset.displayMode);

const cachedUrls = (page: Page) =>
  page.evaluate(async () => {
    const out: string[] = [];
    for (const key of await caches.keys()) for (const r of await (await caches.open(key)).keys()) out.push(new URL(r.url).pathname);
    return out;
  });

test("manifest: érvényes, minden ikon elérhető", async ({ request }) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);
  const m = await res.json();
  expect(m).toMatchObject({ name: "Bank Reminder", display: "standalone", scope: "/", theme_color: "#0B7F70", lang: "hu" });
  expect(m.start_url).toContain("/dashboard");
  expect(m.icons.map((i: { purpose: string; sizes: string }) => `${i.purpose}:${i.sizes}`).sort()).toEqual([
    "any:192x192", "any:512x512", "maskable:192x192", "maskable:512x512",
  ]);
  for (const icon of m.icons) expect((await request.get(icon.src)).status()).toBe(200);

  // Chrome „gazdag telepítő": 2 keskeny + 1 széles képernyőkép; a deklarált méret = a valódi PNG mérete
  const shots = m.screenshots as Array<{ src: string; sizes: string; type: string; form_factor: string }>;
  expect(shots.map((x) => x.form_factor).sort()).toEqual(["narrow", "narrow", "wide"]);
  for (const shot of shots) {
    const img = await request.get(shot.src);
    expect(img.status(), shot.src).toBe(200);
    expect(img.headers()["content-type"]).toContain("image/png");
    const buf = await img.body();
    const [w, h] = [buf.readUInt32BE(16), buf.readUInt32BE(20)];
    expect(`${w}x${h}`, shot.src).toBe(shot.sizes);
  }
});

test("a sw.js nem cache-elhető, az offline oldal saját szigorú CSP-vel jön", async ({ request }) => {
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(sw.headers()["service-worker-allowed"]).toBe("/");
  const offline = await request.get("/offline.html");
  expect(offline.headers()["content-security-policy"]).toContain("default-src 'none'");
});

test("a service worker regisztrál és precache-eli az offline oldalt; a <html> jelzi a megjelenítési módot", async ({ page }) => {
  await page.goto("/dashboard");
  await swReady(page);
  expect(await page.evaluate(() => caches.keys())).toContain("br-static-v1");
  expect(await cachedUrls(page)).toContain("/offline.html");
  await expect(page.locator("html")).toHaveAttribute("data-display-mode", "browser");
});

test("🔴 belépett oldalak bejárása után sincs HTML/adat a SW-cache-ben (csak statikus fájlok)", async ({ page }) => {
  await page.goto("/dashboard");
  await swReady(page);
  for (const path of ["/reminders", "/calendar", "/profile", "/dashboard"]) {
    await page.goto(path);
    await expect(page.locator("main")).toBeVisible();
  }
  const urls = await cachedUrls(page);
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) expect(u, u).toMatch(/^\/(_next\/static\/|icons\/|offline\.html$)/);
  expect(urls.some((u) => u.startsWith("/api") || u === "/dashboard" || u === "/reminders")).toBe(false);
});

test("offline: nem fehér képernyő, hanem az offline oldal (HU+EN), nincs felhasználói adat", async ({ page, context }) => {
  await page.goto("/dashboard");
  await swReady(page);
  await context.setOffline(true);
  await page.goto("/reminders").catch(() => {});
  await expect(page.getByRole("heading", { name: "Nincs kapcsolat" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "You're offline" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("E2E");
  await context.setOffline(false);
});

test("/install: QR-kód és platform-útmutató; felkínált telepítésnél a gomb a böngésző promptját hívja", async ({ page }) => {
  await page.goto("/install");
  await expect(page.getByRole("heading", { name: "Alkalmazás letöltése", level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: "QR-kód az oldal címével" })).toBeVisible();
  await expect(page.getByText("iPhone / iPad (Safari)")).toBeVisible();
  // prompt nélkül (headless) a böngésző nem tud telepíteni → tájékoztatás
  await expect(page.getByText("Ez a böngésző nem tud appot telepíteni")).toBeVisible();

  // a böngésző felkínálja a telepítést → a gomb megjelenik, és a prompt() hívódik
  await hydrated(page);
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => void ((window as unknown as { __prompted: boolean }).__prompted = true);
    e.userChoice = Promise.resolve({ outcome: "accepted" });
    window.dispatchEvent(e);
  });
  await page.getByRole("button", { name: "Alkalmazás letöltése" }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __prompted?: boolean }).__prompted)).toBe(true);
});

test("a telepítés elutasítása után 7 napig nem erőszakoskodik (a kártya/gomb rejtett)", async ({ page }) => {
  await page.goto("/dashboard");
  await hydrated(page);
  await page.evaluate(() => {
    localStorage.setItem("br_visits", "5"); // a kártya az első 3 látogatás után jelenik meg
    const e = new Event("beforeinstallprompt") as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = async () => {};
    e.userChoice = Promise.resolve({ outcome: "dismissed" });
    window.dispatchEvent(e);
  });
  await expect(page.getByRole("heading", { name: "Töltsd le az appot" })).toBeVisible();
  await page.getByRole("button", { name: "Alkalmazás letöltése" }).first().click(); // a böngésző-prompt elutasítása
  await expect(page.getByRole("heading", { name: "Töltsd le az appot" })).toBeHidden();
  expect(Number(await page.evaluate(() => localStorage.getItem("br_install_dismissed_until")))).toBeGreaterThan(Date.now() + 6 * 86_400_000);
});

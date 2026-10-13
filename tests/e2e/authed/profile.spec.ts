import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");

// B-08 átvétele valós fiókkal: shell, profil, téma/nyelv szinkron, profilkép, kijelentkezés
test.describe.configure({ mode: "serial" });

test("a belépett shell a Kijelentkezés gombot és a profil-chipet mutatja", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Főoldal" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Kijelentkezés" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Értesítések" })).toBeVisible();
});

test("profil: áttekintés — e-mail, tagság, statisztika; a szakasz az URL-ben él", async ({ page }) => {
  await page.goto("/profile");
  await expect(page.getByRole("heading", { level: 1, name: "Profil" })).toBeVisible();
  await expect(page.getByText(process.env.E2E_EMAIL!)).toBeVisible();
  await expect(page.getByText("Tag ezóta")).toBeVisible();
  await expect(page.getByText("Aktív emlékeztetők")).toBeVisible();

  await page.getByRole("link", { name: "Megjelenés" }).click();
  await expect(page).toHaveURL(/section=appearance$/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Megjelenés", level: 2 })).toBeVisible();
});

test("megjelenítési név módosítása mentődik (és visszaállítjuk)", async ({ page }) => {
  await page.goto("/profile");
  const field = page.getByLabel("Megjelenítési név");
  const original = await field.inputValue();

  await field.fill("E2E Teszt Elek");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Elmentve.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Megjelenítési név")).toHaveValue("E2E Teszt Elek");

  await page.getByLabel("Megjelenítési név").fill(original);
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Elmentve.")).toBeVisible();
});

test("üres név mező-hibát ad", async ({ page }) => {
  await page.goto("/profile");
  await page.getByLabel("Megjelenítési név").fill("   ");
  await page.getByRole("button", { name: "Mentés" }).click();
  await expect(page.getByText("Ezt a mezőt ki kell töltened.")).toBeVisible();
});

test("a téma és a nyelv a profilba is mentődik (visszaállítva)", async ({ page }) => {
  const { client, userId } = await userClient();
  const read = async () => (await client.from("profiles").select("theme, locale").eq("id", userId).single()).data!;
  const original = await read();

  await page.goto("/profile?section=appearance");
  // megvárjuk a hidratálást: a ProfileSync (belépés utáni egyszeri szinkron) ekkor jelez a sessionStorage-ban
  await page.waitForFunction(() => !!sessionStorage.getItem("br_profile_synced"));
  await page.getByRole("button", { name: "Sötét" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect.poll(async () => (await read()).theme).toBe("dark");

  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Appearance", level: 2 })).toBeVisible();
  await expect.poll(async () => (await read()).locale).toBe("en");

  // visszaállítás a UI-n át (így a szinkron is ellenőrződik)
  await page.getByRole("button", { name: "Magyar" }).click();
  await expect.poll(async () => (await read()).locale).toBe("hu");
  const themeButton = original.theme === "dark" ? "Sötét" : original.theme === "light" ? "Világos" : "Rendszer";
  await page.getByRole("button", { name: themeButton }).click();
  await expect.poll(async () => (await read()).theme).toBe(original.theme);
});

test("profilkép: feltöltés (EXIF nélkül, 256×256 WebP), majd törlés", async ({ page, request }) => {
  const { client, userId } = await userClient();
  const readPath = async () => (await client.from("profiles").select("avatar_path").eq("id", userId).single()).data!.avatar_path;

  // EXIF-et tartalmazó JPEG: a kimenetben nem maradhat benne
  const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: "#0b7f70" } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "E2E-TITKOS-SZERZO" } })
    .toBuffer();

  await page.goto("/profile");
  await page.locator('input[type="file"]:not([capture])').setInputFiles({ name: "teszt.jpg", mimeType: "image/jpeg", buffer: jpeg });
  const cropper = page.getByRole("dialog", { name: "Kép kivágása" });
  await expect(cropper).toBeVisible();
  await cropper.getByRole("button", { name: "Használom" }).click();

  const img = page.getByRole("img", { name: /profilképe/ }).first();
  await expect(img).toHaveAttribute("src", /\/storage\/v1\/object\/public\/avatars\//);
  await expect.poll(readPath).toMatch(new RegExp(`^${userId}/[0-9a-f-]{36}\\.webp$`));

  const src = (await img.getAttribute("src"))!;
  const res = await request.get(src);
  expect(res.status()).toBe(200);
  const body = await res.body();
  const meta = await sharp(body).metadata();
  expect([meta.format, meta.width, meta.height]).toEqual(["webp", 256, 256]);
  expect(meta.exif).toBeUndefined();
  expect(body.includes(Buffer.from("E2E-TITKOS-SZERZO"))).toBe(false);

  // törlés
  await page.getByRole("button", { name: "Kép törlése" }).click();
  await expect.poll(readPath).toBeNull();
  // a fájl a Storage-ból is eltűnt (a nyilvános CDN-URL a cache-élettartamig még kiszolgálhat: ezért nem azt nézzük)
  const left = await client.storage.from("avatars").list(userId);
  expect(left.data ?? []).toEqual([]);
});

test("nem kép tartalom (kép MIME-mal): a kivágó hibát mutat, nincs feltöltés", async ({ page }) => {
  const { client, userId } = await userClient();
  await page.goto("/profile");
  await page.locator('input[type="file"]:not([capture])').setInputFiles({
    name: "hamis.png",
    mimeType: "image/png",
    buffer: Buffer.from("ez nem kép, csak szöveg"),
  });
  await expect(page.getByRole("dialog", { name: "Kép kivágása" }).getByRole("alert")).toContainText("nem sikerült megnyitni");
  expect((await client.from("profiles").select("avatar_path").eq("id", userId).single()).data!.avatar_path).toBeNull();
});

test("kijelentkezés: külön session-nel, hogy a közös teszt-session megmaradjon", async ({ browser }) => {
  // üres storageState: a projekt belépett session-jét NEM örökli (különben a /login a Főoldalra irányítana)
  const context = await browser.newContext({ locale: "hu-HU", storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Jelszó", { exact: true }).fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Belépés" }).last().click();
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/profile?section=security");
  await page.getByRole("button", { name: "Kijelentkezés ezen az eszközön" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.goto("/profile"); // kijelentkezve már nem érhető el
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile$/);
  await context.close();
});

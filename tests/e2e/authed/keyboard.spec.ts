import { expect, test } from "@playwright/test";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// B-29: billentyűzet-használat, látható fókusz, dialógus-fókuszcsapda + fókusz-visszaadás, aria-live visszajelzés (§14.14)
type Db = Awaited<ReturnType<typeof userClient>>;
let db: Db;
const MARK = "e2e-billentyű";

test.beforeAll(async () => {
  db = await userClient();
  await db.client.from("expenses").delete().eq("note", MARK);
});
test.afterAll(async () => {
  await db.client.from("expenses").delete().eq("note", MARK);
});

test("az első Tab az „Ugrás a tartalomhoz” linkre visz, Enter a fő tartalomra ugrik", async ({ page }) => {
  await page.goto("/dashboard");
  await page.keyboard.press("Tab");
  const skip = page.getByRole("link", { name: "Ugrás a tartalomhoz" });
  await expect(skip).toBeFocused();
  await expect(skip).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main$/);
  expect(await page.evaluate(() => document.activeElement?.id)).toBe("main");
});

test("a fókusz látható: billentyűvel fókuszált elemen körvonal vagy árnyék van", async ({ page }) => {
  await page.goto("/dashboard");
  for (let i = 0; i < 4; i++) await page.keyboard.press("Tab");
  const visible = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return false;
    const s = getComputedStyle(el);
    return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== "none";
  });
  expect(visible).toBe(true);
});

test("dialógus: Enterrel nyílik, a fókusz bent marad (csapda), Esc zár és a fókusz visszakerül a gombra", async ({ page }) => {
  await page.goto("/budgets");
  const trigger = page.getByRole("button", { name: "Gyors kiadás" });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Gyors kiadás" });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);

  // natív modális <dialog>: a háttér inert; a körbetabolás a böngésző saját felületén (activeElement = body) is áthaladhat,
  // de az oldal hátterében lévő elemre SOHA nem kerülhet a fókusz
  const insideOrChrome = () => dialog.evaluate((d) => d.contains(document.activeElement) || document.activeElement === document.body);
  for (let i = 0; i < 20; i++) {
    await page.keyboard.press("Tab");
    expect(await insideOrChrome(), `Tab #${i + 1}`).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await insideOrChrome()).toBe(true);
  // a dialógus maga újra fókuszálható elemre ad lehetőséget
  await dialog.getByLabel("Összeg").focus();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test("visszajelzés: a toast aria-live régióban jelenik meg (képernyőolvasó felolvassa)", async ({ page }) => {
  await page.goto("/budgets");
  await page.getByRole("button", { name: "Gyors kiadás" }).click();
  const dialog = page.getByRole("dialog", { name: "Gyors kiadás" });
  await dialog.getByLabel("Összeg").fill("990");
  await dialog.getByLabel(/Megjegyzés/).fill(MARK);
  await dialog.getByRole("button", { name: "Rögzítés" }).click();
  const live = page.locator('[aria-live="polite"]').filter({ hasText: "Kiadás rögzítve." });
  await expect(live).toBeVisible();
});

test("kevesebb mozgás: bekapcsolva az átmenetek gyakorlatilag azonnaliak", async ({ page }) => {
  await page.goto("/profile?section=appearance");
  await page.getByRole("switch", { name: "Kevesebb mozgás" }).click();
  try {
    const ms = await page.getByRole("switch", { name: "Kevesebb mozgás" }).evaluate((el) => parseFloat(getComputedStyle(el.firstElementChild as Element).transitionDuration) * 1000);
    expect(ms).toBeLessThan(1);
  } finally {
    await page.getByRole("switch", { name: "Kevesebb mozgás" }).click();
  }
});

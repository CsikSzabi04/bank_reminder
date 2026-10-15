import { expect, test } from "@playwright/test";
import { hasE2eAccount, userClient } from "../support/db";

test.skip(!hasE2eAccount(), "nincs .env.e2e.local (teszt-fiók)");
test.describe.configure({ mode: "serial" });

// Egy mára esedékes emlékeztető, 0 napos előzménnyel és 00:00-s időponttal → az in-app értesítése azonnal látható.
// Csak a saját sorát törli (id szerint).
let db: Awaited<ReturnType<typeof userClient>>;
let reminderId: string;

test.beforeAll(async () => {
  db = await userClient();
  const today = (await db.client.rpc("user_today")).data as string;
  const { data, error } = await db.client
    .from("reminders")
    .insert({ name: "Értesítés-teszt", amount: 1234, currency: "HUF", start_date: today, recur_unit: "month", recur_every: 1, remind_offsets: [0], remind_time: "00:00:00" })
    .select("id")
    .single();
  if (error || !data) throw new Error("a teszt-emlékeztető létrehozása sikertelen");
  reminderId = data.id;
});
test.afterAll(async () => {
  await db.client.from("reminders").delete().eq("id", reminderId);
});

test("harang: az olvasatlan darabszám a címkében, az oldal listázza a tételt", async ({ page }) => {
  const unread = (await db.client.rpc("unread_notifications")).data as number;
  expect(unread).toBeGreaterThan(0);

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: new RegExp(`^Értesítések, ${unread} olvasatlan$`) })).toBeVisible();

  await page.goto("/notifications");
  await expect(page.getByRole("heading", { level: 1, name: "Értesítések" })).toBeVisible();
  const item = page.getByRole("link", { name: /Értesítés-teszt/ }).first();
  await expect(item).toBeVisible();
  await expect(item).toContainText("Olvasatlan");
});

test("tétel megnyitása: olvasottá válik, és a részletoldalra visz", async ({ page }) => {
  await page.goto("/notifications");
  await page.getByRole("link", { name: /Értesítés-teszt/ }).first().click();
  await expect(page).toHaveURL(new RegExp(`/reminders/${reminderId}`));
  await expect.poll(async () => (await db.client.rpc("unread_notifications")).data).toBe(0);
});

test("Mind olvasottnak: a gomb csak olvasatlannál látszik, kattintásra mindent olvasottá tesz", async ({ page }) => {
  await page.goto("/notifications");
  await expect(page.getByRole("button", { name: "Mind olvasottnak jelölése" })).toHaveCount(0);

  // újra olvasatlanná tesszük (a read_at oszlop frissítése az RLS-sel megengedett)
  await db.client.from("notifications").update({ read_at: null }).eq("reminder_id", reminderId).eq("channel", "in_app");
  await page.reload();
  await expect(page.getByRole("link", { name: /Értesítés-teszt/ }).first()).toContainText("Olvasatlan");
  await page.getByRole("button", { name: "Mind olvasottnak jelölése" }).click();
  await expect(page.getByRole("button", { name: "Mind olvasottnak jelölése" })).toHaveCount(0);
  await expect.poll(async () => (await db.client.rpc("unread_notifications")).data).toBe(0);
});

test("profil → Értesítések: beállítások, ezen az eszközön, naptár-tartalék", async ({ page }) => {
  await page.goto("/profile?section=notifications");
  await expect(page.getByRole("heading", { level: 2, name: "Értesítési beállítások" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "Ezen az eszközön" })).toBeVisible();
  // fejlesztői módban (nem éles build) az SW nincs regisztrálva → a panel ezt magyarázza, nem csendben hibázik
  await expect(page.getByRole("button", { name: "Értesítések bekapcsolása ezen az eszközön" })).toBeVisible();
});

// B-46: „Keret-riasztások” kapcsoló (profiles.budget_alerts). A kötelező bank-lejárat sor csak a bank-összekötésre jogosultnak
// látszik (a teszt-fiók nem az) → ott a unit-teszt (bank-notification-settings) fedi; itt a mentés és a jogosulatlan nézet.
test("profil → Értesítések: a Keret-riasztások kapcsoló menthető és az adatbázisban megjelenik; bank-lejárat sor jogosulatlannak nem látszik", async ({ page }) => {
  const before = (await db.client.from("profiles").select("budget_alerts").eq("id", db.userId).single()).data?.budget_alerts;
  expect(typeof before).toBe("boolean");
  try {
    await page.goto("/profile?section=notifications");
    const box = page.getByRole("checkbox", { name: /Keret-riasztások/ });
    await expect(box).toBeVisible();
    await expect(page.getByText("Bank-hozzáférés lejárata — kötelező")).toHaveCount(0);

    if (await box.isChecked()) await box.uncheck();
    else await box.check();
    await page.getByRole("button", { name: "Mentés", exact: true }).click();
    await expect(page.getByText("Elmentve.")).toBeVisible();
    await expect.poll(async () => (await db.client.from("profiles").select("budget_alerts").eq("id", db.userId).single()).data?.budget_alerts).toBe(!before);

    // újratöltés után is a mentett érték látszik
    await page.reload();
    if (before) await expect(page.getByRole("checkbox", { name: /Keret-riasztások/ })).not.toBeChecked();
    else await expect(page.getByRole("checkbox", { name: /Keret-riasztások/ })).toBeChecked();
  } finally {
    await db.client.from("profiles").update({ budget_alerts: before as boolean }).eq("id", db.userId);
  }
});

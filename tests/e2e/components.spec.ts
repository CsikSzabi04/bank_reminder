import { expect, test } from "@playwright/test";

// B-10: a /dev/ui játszótéren minden állapot kipróbálható (üres, betöltés, hiba, lejárt)

test.beforeEach(async ({ page }) => {
  await page.goto("/dev/ui");
});

test("BillRow: lejárt, ma, holnap, kifizetett és kihagyott állapot szöveggel", async ({ page }) => {
  const row = (name: string) => page.getByRole("listitem").filter({ hasText: name }).first();
  await expect(row("Albérlet")).toContainText("Lejárt · 3 nappal ezelőtt");
  await expect(row("Áram")).toContainText("ma");
  await expect(row("Netflix")).toContainText("holnap");
  await expect(row("Netflix")).toContainText("Minta adat");
  await expect(row("Hitel törlesztés")).toContainText("Kifizetve");
  await expect(row("Edzőterem")).toContainText("Kihagyva");
  await expect(row("Spotify")).toContainText("9,99 USD");
});

test("PayButton: azonnali „Kifizetve”, majd Visszavonás-toast", async ({ page }) => {
  await page.getByRole("button", { name: "Netflix kifizetettnek jelölése" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Netflix" }).first()).toContainText("Kifizetve");
  await expect(page.getByRole("status").filter({ hasText: "Netflix: kifizetve" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Visszavonás" }).first()).toBeVisible();
});

test("PayButton: mentési hibánál hibaüzenet és a gomb visszatér", async ({ page }) => {
  await page.getByLabel("PayButton: a következő mentés hibával végződjön").check();
  const button = page.getByRole("button", { name: "Áram kifizetettnek jelölése" });
  await button.click();
  await expect(page.getByRole("alert").filter({ hasText: "Nem sikerült menteni" })).toBeVisible();
  await expect(button).toBeVisible();
});

test("BottomSheet: megnyílik, Esc zár, a fókusz visszakerül a nyitó gombra", async ({ page }) => {
  const opener = page.getByRole("button", { name: "BottomSheet", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Mikor emlékeztessünk?" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(opener).toBeFocused();
});

test("ConfirmDialog: Mégse zár; Törlés lefut és zár", async ({ page }) => {
  const opener = page.getByRole("button", { name: "ConfirmDialog (törlés)" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Törlöd az emlékeztetőt?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Mégse" }).click();
  await expect(dialog).toBeHidden();

  await opener.click();
  await dialog.getByRole("button", { name: "Törlés" }).click();
  await expect(dialog).toBeHidden();
});

test("Toast: a Visszavonás gomb bezárja, a hiba-toast role=alert", async ({ page }) => {
  await page.getByRole("button", { name: "Toast + Visszavonás" }).click();
  const toast = page.getByRole("status").filter({ hasText: "Netflix: kifizetve" });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Visszavonás" }).click();
  await expect(toast).toBeHidden();

  await page.getByRole("button", { name: "Toast (hiba)" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Nem sikerült menteni" })).toBeVisible();
});

test("üres állapot és betöltő váz látszik", async ({ page }) => {
  await expect(page.getByRole("heading", { name: "Még nincs emlékeztetőd" })).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Betöltés…" })).toBeVisible();
});

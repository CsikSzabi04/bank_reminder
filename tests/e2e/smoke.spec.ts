import { expect, test } from "@playwright/test";

test("a nyitóoldal betölt és kiírja a márkanevet", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Bank Reminder" })).toBeVisible();
});

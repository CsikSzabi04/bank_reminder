import { expect, test } from "@playwright/test";

test("a fejlesztői játszótér betölt", async ({ page }) => {
  await page.goto("/dev/ui");
  await expect(page.getByRole("heading", { name: "/dev/ui" })).toBeVisible();
});

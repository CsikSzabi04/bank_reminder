import { expect, test } from "@playwright/test";

test("védett oldal kijelentkezve → /login?next=…", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard$/);
});

test("a gyökér kijelentkezve a /login-ra visz", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("védett /api/* kijelentkezve → 401 JSON, nem átirányítás", async ({ request }) => {
  const res = await request.get("/api/export", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
  expect(res.headers()["content-type"]).toContain("application/json");
  expect(await res.json()).toEqual({ ok: false, code: "unauthenticated" });
  expect(res.headers()["cache-control"]).toContain("no-store");
});

test("védett profil és avatar-API kijelentkezve nem érhető el", async ({ page, request }) => {
  await page.goto("/profile?section=appearance");
  await expect(page).toHaveURL(/\/login\?next=%2Fprofile%3Fsection%3Dappearance$/);

  const res = await request.post("/api/profile/avatar", { maxRedirects: 0 });
  expect(res.status()).toBe(401);
});

test("a /bank és a szakaszai kijelentkezve a belépéshez visznek (B-40)", async ({ page }) => {
  await page.goto("/bank?section=android");
  await expect(page).toHaveURL(/\/login\?next=%2Fbank%3Fsection%3Dandroid$/);
});

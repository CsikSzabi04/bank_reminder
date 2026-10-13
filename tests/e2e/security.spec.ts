import { expect, test, type Page } from "@playwright/test";

// A böngésző securitypolicyviolation eseményeit gyűjtjük: a CSP nem törheti el az oldalakat
async function collectViolations(page: Page) {
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) =>
      (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ← ${e.blockedURI}`),
    );
  });
  return () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp);
}

test("válasz-fejlécek: nonce-os CSP + a statikus biztonsági fejlécek", async ({ request }) => {
  const res = await request.get("/login");
  const h = res.headers();
  expect(h["content-security-policy"]).toMatch(/script-src [^;]*'nonce-[A-Za-z0-9+/=]+'/);
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["permissions-policy"]).toContain("camera=()");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("a nonce kérésenként más", async ({ request }) => {
  const nonceOf = async () => (await request.get("/login")).headers()["content-security-policy"].match(/'nonce-([^']+)'/)![1];
  expect(await nonceOf()).not.toBe(await nonceOf());
});

test("az oldal scriptjei a fejléc nonce-át viselik (a téma-script is)", async ({ page }) => {
  const response = await page.goto("/login");
  const header = response!.headers()["content-security-policy"];
  const nonce = header.match(/'nonce-([^']+)'/)![1];
  const nonces = await page.evaluate(() =>
    [...document.querySelectorAll("script")].filter((s) => !s.src).map((s) => s.nonce),
  );
  expect(nonces.length).toBeGreaterThan(0);
  for (const n of nonces) expect(n).toBe(nonce);
});

for (const path of ["/login", "/signup", "/forgot-password", "/dev/ui"]) {
  test(`${path}: nincs CSP-sértés betöltéskor, téma- és nyelvváltáskor`, async ({ page }) => {
    const violations = await collectViolations(page);
    await page.goto(path);
    await page.getByRole("button", { name: "Sötét" }).click();
    await expect(page.locator("html")).toHaveClass(/dark/);
    await page.getByRole("button", { name: "English" }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    expect(await violations()).toEqual([]);
  });
}

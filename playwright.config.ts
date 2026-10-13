import { defineConfig, devices } from "@playwright/test";

// 360 px (mobil) és 1280 px (asztal) nézet minden e2e tesztre (§22.1).
// A "security" projekt a PRODUCTION buildet teszteli (a nonce-os CSP csak ott szigorú): `npm run test:e2e:prod`.
const PROD_PORT = 3101;
const prod = Boolean(process.env.E2E_PROD);
const SECURITY_SPEC = "**/security.spec.ts";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["e2e/**/*.spec.ts", "a11y/**/*.spec.ts"],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    // a böngésző Accept-Language-e adja az alap nyelvet (§20.1): a tesztek magyar felületet várnak
    locale: "hu-HU",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "e2e-mobile",
      testDir: "./tests/e2e",
      testIgnore: SECURITY_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 } },
    },
    {
      name: "e2e-desktop",
      testDir: "./tests/e2e",
      testIgnore: SECURITY_SPEC,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "security",
      testDir: "./tests/e2e",
      testMatch: SECURITY_SPEC,
      use: { ...devices["Desktop Chrome"], baseURL: `http://localhost:${PROD_PORT}` },
    },
    {
      name: "a11y",
      testDir: "./tests/a11y",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    // a production szerver a `next build` után indul (E2E_PROD=1)
    ...(prod
      ? [
          {
            command: `npm run start -- -p ${PROD_PORT}`,
            url: `http://localhost:${PROD_PORT}/api/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
          },
        ]
      : []),
  ],
});

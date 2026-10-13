import { existsSync, readFileSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";
import { AUTH_FILE } from "./tests/e2e/support/paths";

// A helyi, gitignore-os env fájlokat a teszt-folyamat is látja (a dev szervert a Next maga tölti be).
// Az értékeket SOHA nem írjuk ki. `.env.e2e.local`: E2E_EMAIL / E2E_PASSWORD (az AI-A hozta létre a teszt-fiókot).
for (const file of [".env.local", ".env.e2e.local"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

// 360 px (mobil) és 1280 px (asztal) nézet minden e2e tesztre (§22.1).
// A "security" projekt a PRODUCTION buildet teszteli (a nonce-os CSP csak ott szigorú): `npm run test:e2e:prod`.
// Az "authed" projekt a teszt-fiókkal belépve fut (a "setup" projekt menti a session-t); fiók nélkül kimarad.
const PROD_PORT = 3101;
const prod = Boolean(process.env.E2E_PROD);
const PUBLIC_IGNORE = ["**/security.spec.ts", "**/authed/**", "**/auth.setup.ts"];

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
      testIgnore: PUBLIC_IGNORE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 360, height: 740 } },
    },
    {
      name: "e2e-desktop",
      testDir: "./tests/e2e",
      testIgnore: PUBLIC_IGNORE,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } },
    },
    {
      name: "setup",
      testDir: "./tests/e2e",
      testMatch: "**/auth.setup.ts",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "authed",
      testDir: "./tests/e2e/authed",
      testMatch: "**/*.spec.ts",
      dependencies: ["setup"],
      // Ugyanazt a (közös) teszt-fiókot használják → CSAK sorban futhatnak: `npm run test:e2e:authed` (--workers=1).
      // Párhuzamosan egymás adatait és a megosztott refresh-token session-t zavarnák.
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 }, storageState: AUTH_FILE },
    },
    {
      name: "security",
      testDir: "./tests/e2e",
      testMatch: "**/security.spec.ts",
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

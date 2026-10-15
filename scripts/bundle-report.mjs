// Első betöltési JS-méret oldalanként (gzip, átvitt bájt) a production buildből — a §22.4 cél: Főoldal ≤ ~200 kB gzip.
// Használat: `npm run build`, majd `npm run start -- -p 3101` egy másik terminálban, aztán `node scripts/bundle-report.mjs`.
// A belépett oldalakhoz a `playwright/.auth/state.json` kell (futtasd előtte a `test:e2e:prod`-ot vagy a setup projektet).
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const BASE = process.env.BASE_URL ?? "http://localhost:3101";
const AUTH = "playwright/.auth/state.json";
const PAGES = ["/login", "/dashboard", "/reminders", "/reminders/new", "/analytics", "/budgets", "/savings", "/tips", "/news", "/calendar", "/profile", "/notifications"];

const browser = await chromium.launch();
const rows = [];
for (const path of PAGES) {
  // minden oldal friss környezetben (gyorsítótár nélkül), hogy az első betöltés valódi mérete látszódjon
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, ...(existsSync(AUTH) ? { storageState: AUTH } : {}) });
  const page = await ctx.newPage();
  const sizes = [];
  const files = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (!/\.js(\?|$)/.test(url)) return;
    try {
      const size = (await res.request().sizes()).responseBodySize;
      sizes.push(size);
      files.push([url.split("/").pop()?.slice(0, 40) ?? url, size]);
    } catch {
      /* a lap közben bezáródott kérés */
    }
  });
  await page.goto(BASE + path, { waitUntil: "networkidle" });
  const final = new URL(page.url()).pathname;
  rows.push({ path, final, files: sizes.length, kb: sizes.reduce((a, b) => a + Math.max(0, b), 0) / 1024, top: files.sort((a, b) => b[1] - a[1]).slice(0, 4) });
  await ctx.close();
}
await browser.close();

for (const r of rows) {
  console.log(`${r.path.padEnd(18)} ${r.final === r.path ? "  " : "→ " + r.final}  ${r.files} fájl  ${r.kb.toFixed(1)} kB gzip`);
  if (process.env.TOP) console.log("   " + r.top.map(([f, b]) => `${f} ${(b / 1024).toFixed(1)}`).join(" · "));
}
const worst = rows.filter((r) => r.final === r.path).sort((a, b) => b.kb - a.kb)[0];
console.log(`\nlegnagyobb: ${worst.path} (${worst.kb.toFixed(1)} kB) · cél ≤ ~200 kB`);

// Production-build e2e (nonce-os CSP): build → next start → Playwright "security" (+ "pwa") projekt. Platformfüggetlen.
// A "pwa" projekt belépett session-t igényel (a teszt-fiók: .env.e2e.local vagy E2E_EMAIL/E2E_PASSWORD); fiók nélkül csak a "security" fut.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const run = (command, args, env = {}) =>
  spawnSync(command, args, { stdio: "inherit", shell: true, env: { ...process.env, ...env } }).status ?? 1;

if (run("npm", ["run", "build"]) !== 0) process.exit(1);

const hasAccount = Boolean((process.env.E2E_EMAIL && process.env.E2E_PASSWORD) || existsSync(".env.e2e.local"));
const projects = hasAccount ? ["--project=security", "--project=pwa"] : ["--project=security"];
if (!hasAccount) console.log("e2e-prod: nincs teszt-fiók → csak a security projekt fut (a pwa belépést igényel)");
process.exit(run("npx", ["playwright", "test", ...projects, "--workers=1"], { E2E_PROD: "1" }));

// Production-build e2e (nonce-os CSP): build → next start → Playwright "security" projekt. Platformfüggetlen.
import { spawnSync } from "node:child_process";

const run = (command, args, env = {}) =>
  spawnSync(command, args, { stdio: "inherit", shell: true, env: { ...process.env, ...env } }).status ?? 1;

if (run("npm", ["run", "build"]) !== 0) process.exit(1);
process.exit(run("npx", ["playwright", "test", "--project=security", "--project=pwa", "--workers=1"], { E2E_PROD: "1" }));

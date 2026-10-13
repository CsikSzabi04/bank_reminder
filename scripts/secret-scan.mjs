#!/usr/bin/env node
// A-01: pre-commit titok-szkenner (H3). A staged fájlokat nézi; találatnál a commit bukik.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const RULES = [
  [/sb_secret_[A-Za-z0-9_-]{8,}/, 'Supabase secret key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'privát kulcs'],
  [/postgres(ql)?:\/\/[^:\s@]+:[^@\s\[<]{4,}@/, 'jelszót tartalmazó DB-kapcsolati string'],
  [/(SUPABASE_DB_PASSWORD|VAPID_PRIVATE_KEY|CRON_SECRET|SUPABASE_ACCESS_TOKEN)\s*[=:]\s*['"]?[A-Za-z0-9_\-+/=]{8,}/, 'titok értékkel'],
  [/\bsbp_[a-f0-9]{30,}\b/, 'Supabase access token'],
  [/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JWT (service_role?)'],
];
const SKIP = /(^|\/)(\.env\.example|scripts\/secret-scan\.mjs|ARCHITECTURE\.md|CLAUDE\.md|package-lock\.json)$/;

const files = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
  .split('\n').filter(Boolean).filter((f) => !SKIP.test(f) && !/\.(png|jpe?g|webp|ico)$/i.test(f));
let hits = 0;
for (const f of files) {
  let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  for (const [re, what] of RULES) if (re.test(txt)) { console.error(`✖ ${f}: ${what}`); hits++; }
}
if (hits) { console.error('A commit megszakítva (H3). Töröld a titkot a fájlból.'); process.exit(1); }

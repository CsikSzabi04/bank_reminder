#!/usr/bin/env node
// H2 védelem: csak a Bank_Reminder Supabase projekttel dolgozunk.
// Használat: node scripts/assert-project.mjs [--url <supabase-url|db-url>]
import { existsSync, readFileSync } from 'node:fs';

const ALLOWED_REF = 'ddvzslgwexvdolovqqlg';
const found = [];

function add(label, text) {
  if (!text) return;
  const refs = new Set(text.match(/[a-z]{20}(?=\.supabase\.co|\.pooler|:|\/|$)/g) ?? []);
  // pooler user: postgres.<ref>
  for (const m of text.matchAll(/postgres\.([a-z]{20})/g)) refs.add(m[1]);
  found.push({ label, text, refs });
}

const argUrl = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : null;
add('--url', argUrl);
add('env NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL);
if (existsSync('.env.local')) {
  const m = readFileSync('.env.local', 'utf8').match(/^NEXT_PUBLIC_SUPABASE_URL=(.+)$/m);
  add('.env.local', m?.[1]?.trim());
}
if (existsSync('supabase/.temp/project-ref')) add('supabase/.temp/project-ref', readFileSync('supabase/.temp/project-ref', 'utf8').trim());

let bad = false;
for (const f of found) {
  const hostRef = f.text.match(/^https?:\/\/([a-z]{20})\.supabase\.co/)?.[1] ?? (/^[a-z]{20}$/.test(f.text) ? f.text : null);
  const refs = hostRef ? [hostRef] : [...f.refs];
  if (refs.length && refs.some((r) => r !== ALLOWED_REF)) {
    console.error(`✖ ${f.label}: nem engedélyezett Supabase projekt (${refs.join(', ')}). Csak ${ALLOWED_REF} használható. STOP.`);
    bad = true;
  }
}
if (bad) process.exit(1);
console.log(`✔ db:assert — ${found.length ? 'ellenőrzött források rendben' : 'nincs ellenőrizendő forrás'} (engedélyezett: ${ALLOWED_REF})`);

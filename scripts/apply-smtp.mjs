#!/usr/bin/env node
// Egyedi SMTP bekapcsolása + a szép e-mail sablonok élesítése (A-04/A-05). A hitelesítő adat a gitignore-os `.env.smtp.local`-ból jön,
// a Supabase CLI-nek KÖRNYEZETI változóként adjuk át (a config.toml csak `env(SMTP_PASS)` hivatkozást tartalmaz) — jelszó soha nem kerül fájlba/konzolra.
//   node scripts/apply-smtp.mjs
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const REF = 'ddvzslgwexvdolovqqlg';
const ENV = '.env.smtp.local';
if (!existsSync(ENV)) { console.error(`✖ Hiányzik a ${ENV} (másold a ${ENV}.example-ből, és töltsd ki).`); process.exit(2); }
const env = Object.fromEntries(readFileSync(ENV, 'utf8').split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
  .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const user = env.SMTP_USER; const pass = (env.SMTP_PASS ?? '').replace(/\s+/g, '');       // a Google a jelszót szóközökkel mutatja
if (!user || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(user)) { console.error('✖ SMTP_USER hiányzik vagy nem e-mail cím.'); process.exit(2); }
if (!pass || pass.length < 12) { console.error('✖ SMTP_PASS hiányzik / túl rövid (a Google alkalmazásjelszó 16 karakter).'); process.exit(2); }
const host = env.SMTP_HOST || 'smtp.gmail.com'; const port = Number(env.SMTP_PORT || 465);

copyFileSync('supabase/config.toml', 'supabase/config.toml.bak');
let s = readFileSync('supabase/config.toml', 'utf8');
if (!s.includes('[auth.email.smtp]')) {
  s = s.replace(/\n\[auth\.sms\]/, `\n[auth.email.smtp]\nenabled = true\nhost = "${host}"\nport = ${port}\nuser = "env(SMTP_USER)"\npass = "env(SMTP_PASS)"\nadmin_email = "env(SMTP_USER)"\nsender_name = "Bank Reminder"\n\n[auth.sms]`);
  if (!s.includes('[auth.email.smtp]')) { console.error('✖ nem találtam a beszúrási pontot a config.toml-ban'); process.exit(3); }
}
// sablonok kikommentelése (az alap SMTP-vel a platform visszautasítja; egyedi SMTP-vel engedett)
s = s.replace(/^# (\[auth\.email\.template\.[a-z_]+\]|subject = .*|content_path = .*)$/gm, '$1');
// egyedi SMTP mellett a levélküldési korlát emelhető (alap: 2/óra)
s = s.replace(/(\[auth\.rate_limit\][\s\S]*?\n)email_sent = \d+/, '$1email_sent = 30');
writeFileSync('supabase/config.toml', s);

const r = spawnSync('npx', ['--yes', 'supabase@latest', 'config', 'push', '--project-ref', REF], {
  shell: process.platform === 'win32', encoding: 'utf8', input: 'y\nn\n', env: { ...process.env, SMTP_USER: user, SMTP_PASS: pass },
});
const out = `${r.stdout}\n${r.stderr}`;
if (/"_tag":"Error"|ConfigPush.*Error|unexpected status/i.test(out) || r.status !== 0) {
  copyFileSync('supabase/config.toml.bak', 'supabase/config.toml');
  console.error('✖ A config push sikertelen — a config.toml visszaállítva. Hiba:\n' + (out.match(/"message":"[^"]{0,300}/)?.[0] ?? out.slice(-400)));
  process.exit(4);
}
console.log('✔ Egyedi SMTP + e-mail sablonok felpusholva. (A config.toml csak env(SMTP_*) hivatkozást tartalmaz.)');
console.log('  A következő regisztrációs / jelszó-visszaállító levél már a Bank Reminder sablonjával megy ki.');

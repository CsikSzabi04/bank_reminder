#!/usr/bin/env node
// A-18: titkok beállítása EGYSZER — CRON_SECRET (Vault + Edge secret), VAPID-pár (Edge secret), opcionálisan APP_BASE_URL / VAPID_SUBJECT.
// Előfeltétel: `npx supabase login` (a gazda egyszer) + SUPABASE_DB_PASSWORD környezeti változó. Titok NEM kerül fájlba/konzolra:
// a Supabase CLI-nek ideiglenes env-fájlon át adjuk át, majd azonnal töröljük.
//   node scripts/setup-secrets.mjs [--subject mailto:x@y.z|https://domain] [--app-url https://domain] [--rotate-vapid] [--rotate-cron]
//   --enable-key <fájl.pem> [--enable-app-id <uuid>] [--dry-run]   (A-47) Enable Banking: ENABLE_APP_ID + ENABLE_PRIVATE_KEY Edge secret. A kulcsfájl PKCS#8 („PRIVATE KEY"),
//        az App ID a fájlnév végi UUID (vagy --enable-app-id). A kulcs tartalma SOHA nem íródik ki; --dry-run: csak ellenőriz, nem tölt fel (DB-jelszó sem kell).
import { spawnSync } from 'node:child_process';
import { randomBytes, webcrypto } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateVapid } from './gen-vapid.mjs';

const REF = 'ddvzslgwexvdolovqqlg';
const args = process.argv.slice(2);
const opt = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : undefined);
const run = (a, o = {}) => spawnSync('npx', ['--yes', 'supabase@latest', ...a], { shell: process.platform === 'win32', encoding: 'utf8', ...o });

// ── Enable Banking kulcs (A-47): még a DB-hívások előtt ellenőrizzük, hogy a hiba ne félúton jöjjön
const enableSecrets = {};
if (opt('--enable-key')) {
  const file = opt('--enable-key');
  let pem;
  try { pem = readFileSync(file, 'utf8'); } catch { console.error('✖ Az Enable-kulcsfájl nem olvasható:', file); process.exit(5); }
  const kind = /-----BEGIN ([A-Z ]+)-----/.exec(pem)?.[1];
  if (kind !== 'PRIVATE KEY') { console.error(`✖ A kulcs formátuma „${kind ?? '?'}", PKCS#8 („BEGIN PRIVATE KEY") kell.`); process.exit(5); }
  const body = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');   // egysoros base64: az env-fájl nem bírja a sortörést
  const appId = opt('--enable-app-id') ?? /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.pem$/i.exec(file)?.[1];
  if (!appId) { console.error('✖ Az App ID nem olvasható a fájlnévből (…<uuid>.pem): add meg --enable-app-id-vel.'); process.exit(5); }
  try { await webcrypto.subtle.importKey('pkcs8', Buffer.from(body, 'base64'), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']); }
  catch { console.error('✖ A kulcs nem importálható (nem érvényes PKCS#8 RSA-kulcs).'); process.exit(5); }
  enableSecrets.ENABLE_APP_ID = appId;
  enableSecrets.ENABLE_PRIVATE_KEY = body;
  console.log(`✔ Enable-kulcs rendben (App ID ${appId}; a kulcs értéke nem kerül kiírásra)`);
  if (args.includes('--dry-run')) { console.log('ℹ --dry-run: nem töltöttem fel semmit.'); process.exit(0); }
}

const pw = process.env.SUPABASE_DB_PASSWORD;
if (!pw) { console.error('✖ SUPABASE_DB_PASSWORD hiányzik (csak a shellben, fájlba soha).'); process.exit(2); }
const url = `postgresql://postgres:${encodeURIComponent(pw)}@db.${REF}.supabase.co:5432/postgres`;
if (spawnSync(process.execPath, ['scripts/assert-project.mjs', '--url', url], { stdio: 'inherit' }).status !== 0) process.exit(1);

const who = run(['secrets', 'list', '--project-ref', REF]);
if (who.status !== 0) { console.error('✖ A Supabase CLI nincs bejelentkezve. Futtasd egyszer: npx supabase login'); process.exit(3); }
let existing;
try { existing = new Set((JSON.parse(who.stdout).secrets ?? []).map((s) => s.name ?? s.Name)); }                                // a CLI nem-TTY módban JSON-t ad
catch { existing = new Set((who.stdout.match(/^\s*([A-Z][A-Z0-9_]+)\s*\|/gm) ?? []).map((l) => l.replace(/[\s|]/g, ''))); }   // régebbi táblázatos kimenet

const { default: pg } = await import('pg');
const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
const toSet = {};
try {
  // CRON_SECRET: Vault ↔ Edge secret azonos érték
  const { rows } = await c.query("select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret' limit 1");
  let cron = rows[0]?.decrypted_secret;
  if (!cron || args.includes('--rotate-cron')) {
    cron = randomBytes(32).toString('hex');
    if (rows[0]) await c.query("select vault.update_secret((select id from vault.secrets where name = 'cron_secret'), $1)", [cron]);
    else await c.query("select vault.create_secret($1, 'cron_secret', 'pg_cron → Edge Function hitelesítés')", [cron]);
    console.log('✔ cron_secret létrehozva/frissítve a Vaultban');
  }
  if (!existing.has('CRON_SECRET') || args.includes('--rotate-cron')) toSet.CRON_SECRET = cron;

  // VAPID-pár
  if (!existing.has('VAPID_PRIVATE_KEY') || args.includes('--rotate-vapid')) {
    const v = generateVapid();
    toSet.VAPID_PRIVATE_KEY = v.privateKey;
    toSet.VAPID_PUBLIC_KEY = v.publicKey;
    console.log(`✔ új VAPID-pár — NEXT_PUBLIC_VAPID_PUBLIC_KEY=${v.publicKey}`);
    if (args.includes('--rotate-vapid')) console.log('⚠ VAPID-csere: minden eszköznek újra fel kell iratkoznia az értesítésre.');
  }
  if (!existing.has('VAPID_SUBJECT') || opt('--subject')) toSet.VAPID_SUBJECT = opt('--subject') ?? 'mailto:admin@example.com';
  if (opt('--app-url')) toSet.APP_BASE_URL = opt('--app-url');
} finally { await c.end(); }

Object.assign(toSet, enableSecrets);
if (Object.keys(toSet).length) {
  const dir = mkdtempSync(join(tmpdir(), 'br-'));
  const file = join(dir, 'secrets.env');
  try {
    writeFileSync(file, Object.entries(toSet).map(([k, v]) => `${k}=${v}`).join('\n') + '\n', { mode: 0o600 });
    const r = run(['secrets', 'set', '--env-file', file, '--project-ref', REF], { stdio: ['ignore', 'ignore', 'pipe'] });
    if (r.status !== 0) { console.error('✖ secrets set sikertelen:', (r.stderr ?? '').split('\n')[0]); process.exit(4); }
    console.log(`✔ Edge secret-ek beállítva: ${Object.keys(toSet).join(', ')}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
} else console.log('✔ minden szükséges secret már be van állítva');
if (toSet.VAPID_SUBJECT === 'mailto:admin@example.com') console.log('ℹ VAPID_SUBJECT ideiglenes (mailto:admin@example.com). Valós domain/e-mail után: --subject https://<domain>');

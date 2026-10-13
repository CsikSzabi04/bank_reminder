#!/usr/bin/env node
// E2E teszt-fiók az ÉLŐ (dev) projekten — a gazda kifejezett engedélyével (2026-10-13). Megerősített felhasználó közvetlen
// auth.users + identities beszúrással (az alap SMTP csak csapattagnak küld). A hitelesítő adat CSAK a gitignore-os `.env.e2e.local`-ba kerül (H3).
//   SUPABASE_DB_PASSWORD=… node scripts/e2e-user.mjs create|delete      (újra futtatva `create` új jelszót állít)
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const REF = 'ddvzslgwexvdolovqqlg';
const EMAIL = 'e2e@bank-reminder.invalid';
const FILE = '.env.e2e.local';
const cmd = process.argv[2];
const pw = process.env.SUPABASE_DB_PASSWORD;
if (!['create', 'delete'].includes(cmd) || !pw) { console.error('használat: SUPABASE_DB_PASSWORD=… node scripts/e2e-user.mjs create|delete'); process.exit(2); }
const url = `postgresql://postgres:${encodeURIComponent(pw)}@db.${REF}.supabase.co:5432/postgres`;
if (spawnSync(process.execPath, ['scripts/assert-project.mjs', '--url', url], { stdio: 'inherit' }).status !== 0) process.exit(1);

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await c.connect();
try {
  if (cmd === 'delete') {
    const r = await c.query('delete from auth.users where email = $1', [EMAIL]);   // a kaszkád viszi a profilt és minden adatot
    console.log(`✔ törölve: ${r.rowCount} felhasználó`);
    if (existsSync(FILE)) writeFileSync(FILE, '# (törölt e2e-fiók)\n');
  } else {
    const password = randomBytes(18).toString('base64url') + 'a1';       // betű+szám, ≥ 8
    await c.query('begin');
    const existing = (await c.query('select id from auth.users where email = $1', [EMAIL])).rows[0];
    const uid = existing?.id ?? randomUUID();
    if (!existing) {
      await c.query(
        `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, confirmation_token, recovery_token,
                                 email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
         values ('00000000-0000-0000-0000-000000000000', $1::uuid, 'authenticated', 'authenticated', $2, extensions.crypt($3, extensions.gen_salt('bf')), now(), '', '', '', '',
                 '{"provider":"email","providers":["email"]}', '{"display_name":"E2E Teszt","locale":"hu","e2e":true}', now(), now())`, [uid, EMAIL, password]);
    } else {
      await c.query("update auth.users set encrypted_password = extensions.crypt($2, extensions.gen_salt('bf')), email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = $1::uuid", [uid, password]);
    }
    await c.query(
      `insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
       select gen_random_uuid(), $1::uuid, $2::jsonb, 'email', $3::text, now(), now(), now()
        where not exists (select 1 from auth.identities where user_id = $1::uuid and provider = 'email')`,
      [uid, JSON.stringify({ sub: uid, email: EMAIL, email_verified: true, phone_verified: false }), uid]);
    await c.query('commit');
    writeFileSync(FILE, `# AI-A által generált E2E teszt-fiók (élő dev projekt). GITIGNORE-OS — soha ne commitold. Törlés: node scripts/e2e-user.mjs delete\nE2E_EMAIL=${EMAIL}\nE2E_PASSWORD=${password}\n`, { mode: 0o600 });
    console.log(`✔ E2E-fiók kész (${EMAIL}); hitelesítő adat → ${FILE}`);
  }
} catch (e) { try { await c.query('rollback'); } catch { /* nincs nyitott tranzakció */ } throw e; }
finally { await c.end(); }

#!/usr/bin/env node
// A-oldali DB-eszköz (nincs Docker/psql igény). Mindig a H2-védővel indul.
//   node scripts/db.mjs assert | push [--yes] | deploy [név…] | types | test [név] | sql (-e "..."|-f fájl) [--rollback]
// Titok: SUPABASE_DB_PASSWORD környezeti változó (csak helyben; soha fájlba/repóba — H3).
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';

const REF = 'ddvzslgwexvdolovqqlg';
const [cmd = 'help', ...args] = process.argv.slice(2);

function dbUrl() {
  const pw = process.env.SUPABASE_DB_PASSWORD;
  if (!pw) { console.error('✖ Hiányzik a SUPABASE_DB_PASSWORD környezeti változó (csak helyben állítsd be; fájlba/repóba SOHA).'); process.exit(2); }
  const url = `postgresql://postgres:${encodeURIComponent(pw)}@db.${REF}.supabase.co:5432/postgres`;
  const a = spawnSync(process.execPath, ['scripts/assert-project.mjs', '--url', url], { stdio: 'inherit' });
  if (a.status !== 0) process.exit(1);
  return url;
}
const run = (c, a, o = {}) => spawnSync(c, a, { shell: process.platform === 'win32', encoding: 'utf8', ...o });

async function withClient(fn) {
  const { default: pg } = await import('pg');
  const c = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } });
  c.on('notice', (n) => console.log('  ·', n.message));
  await c.connect();
  try { return await fn(c); } finally { await c.end(); }
}

switch (cmd) {
  case 'assert':
    process.exit(spawnSync(process.execPath, ['scripts/assert-project.mjs'], { stdio: 'inherit' }).status ?? 1);
  case 'push': {
    const r = run('npx', ['--yes', 'supabase@latest', 'db', 'push', '--db-url', dbUrl(), ...(args.includes('--yes') ? ['--yes'] : [])], { stdio: 'inherit' });
    process.exit(r.status ?? 1);
  }
  case 'deploy': {   // Edge Function-ök telepítése (CLI-bejelentkezés kell: npx supabase login)
    dbUrl();          // H2-védő
    const names = args.length ? args : readdirSync('supabase/functions', { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('_')).map((d) => d.name);
    for (const n of names) {
      console.log('→ deploy', n);
      const r = run('npx', ['--yes', 'supabase@latest', 'functions', 'deploy', n, '--project-ref', REF, '--use-api', '--no-verify-jwt'], { stdio: 'inherit' });
      if (r.status !== 0) process.exit(r.status ?? 1);
    }
    break;
  }
  case 'types': {
    const r = run('npx', ['--yes', 'supabase@latest', 'gen', 'types', 'typescript', '--db-url', dbUrl(), '--schema', 'public']);
    if (r.status !== 0 || !r.stdout.includes('export type Database')) { console.error(r.stderr); process.exit(1); }
    writeFileSync('types/database.types.ts', r.stdout);
    run('npx', ['--yes', 'oxfmt', 'types/database.types.ts'], { stdio: 'ignore' });
    console.log('✔ types/database.types.ts frissítve');
    break;
  }
  case 'test': {
    const only = args[0];
    const files = readdirSync('supabase/tests').filter((f) => f.endsWith('.test.sql') && (!only || f.includes(only))).sort();
    let failed = 0;
    await withClient(async (c) => {
      for (const f of files) {
        try {
          await c.query('begin');
          await c.query(readFileSync(`supabase/tests/${f}`, 'utf8'));
          console.log(`✔ ${f}`);
        } catch (e) { failed++; console.error(`✖ ${f}: ${e.message}${e.where ? '\n    ' + e.where : ''}`); }
        finally { await c.query('rollback'); }
      }
    });
    console.log(failed ? `✖ ${failed}/${files.length} teszt bukott` : `✔ ${files.length} teszt zöld (mind ROLLBACK-kel futott)`);
    process.exit(failed ? 1 : 0);
  }
  case 'sql': {
    const sql = args.includes('-f') ? readFileSync(args[args.indexOf('-f') + 1], 'utf8') : args[args.indexOf('-e') + 1];
    const rb = args.includes('--rollback');
    await withClient(async (c) => {
      if (rb) await c.query('begin');
      const r = await c.query(sql);
      for (const x of Array.isArray(r) ? r : [r]) if (x.rows?.length) console.log(JSON.stringify(x.rows));
      if (rb) { await c.query('rollback'); console.log('(ROLLBACK)'); }
    });
    break;
  }
  default:
    console.log('használat: node scripts/db.mjs assert | push [--yes] | types | test [név] | sql (-e "..."|-f fájl) [--rollback]');
}

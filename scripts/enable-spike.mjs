#!/usr/bin/env node
// A-40: Enable Banking spike (PoC) — a sandbox-alkalmazással, a Mock ASPSP-vel. NEM éles kód: kérdéseket válaszol meg (advanced.md §10.2).
//   node scripts/enable-spike.mjs                  → /application + /aspsps (nincs böngésző)
//   node scripts/enable-spike.mjs --auth           → + Mock ASPSP-összekötés: kiírja az URL-t, a helyi :3000/bank/callback figyel, code → session → számlák/tranzakciók
//   --key <fájl.pem>   (alap: a repo gyökerének egyetlen *.pem fájlja; a fájlnév = az App ID)
//   --aspsp "<név>" --country HU   (alap: Mock ASPSP / HU)
//   --keep             a session NEM törlődik a végén
//   --redirect <url>   (alap: az alkalmazás első illő átirányítási címe: Production → https, sandbox → localhost)
//   --days <n>         ennyi napra visszamenő tranzakciók (alap: 30)
//   --redact           csak szerkezet/darabszám, érték nélkül; PRODUCTION-alkalmazásnál MINDIG be van kapcsolva (valódi bankadat nem kerülhet a kimenetbe)
// H3: a privát kulcs csak a memóriában él, SOHA nem íródik ki (sem a JWT); az App ID nem titok.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { randomUUID, webcrypto } from 'node:crypto';

const API = 'https://api.enablebanking.com';
const STATE_FILE = join(tmpdir(), 'enable-spike-state.json');   // a --finish módhoz (nincs titok: a state + az auth azonosítója)
const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };

const keyFile = opt('key', readdirSync('.').find((f) => /^[0-9a-f-]{36}\.pem$/i.test(f)));
if (!keyFile) { console.error('✖ Nincs *.pem a repo gyökerében (--key <fájl>).'); process.exit(2); }
// a fájlnév végén álló UUID az App ID (a „Revolut_<uuid>.pem" előtag nem számít)
const APP_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.pem$/i.exec(keyFile)?.[1];
if (!APP_ID) { console.error('✖ a kulcsfájl neve nem „…<app-id>.pem".'); process.exit(2); }

// ── JWT (RS256) a WebCrypto-val — pontosan az, ami az Edge Function-ben (Deno) is megy: nincs külső könyvtár
const b64u = (buf) => Buffer.from(buf).toString('base64url');
async function importKey() {
  const pem = readFileSync(keyFile, 'utf8');
  const kind = /-----BEGIN ([A-Z ]+)-----/.exec(pem)?.[1] ?? '?';
  if (kind !== 'PRIVATE KEY') throw new Error(`a kulcs formátuma „${kind}", PKCS#8 („PRIVATE KEY") kell a WebCrypto-hoz`);
  const der = Buffer.from(pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, ''), 'base64');
  const key = await webcrypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  console.log(`· kulcs: ${kind}, ${key.algorithm.modulusLength} bit, WebCrypto-val importálható ✔ (az értéke nem kerül kiírásra)`);
  return key;
}
async function makeJwt(key, ttl = 3600) {
  const iat = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: APP_ID }));
  const body = b64u(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat, exp: iat + ttl }));
  const sig = await webcrypto.subtle.sign('RSASSA-PKCS1-v1_5', key, Buffer.from(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

let jwt;
async function call(method, path, body) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${jwt}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, json };
}
const show = (title, v) => console.log(`\n── ${title}\n${typeof v === 'string' ? v : JSON.stringify(v, null, 2)}`);
const shape = (v) => Array.isArray(v) ? `[${v.length}× ${v.length ? shape(v[0]) : '?'}]` : v && typeof v === 'object' ? `{${Object.entries(v).map(([k, x]) => `${k}: ${shape(x)}`).join(', ')}}` : typeof v;
const mask = (s) => (typeof s === 'string' && s.length > 4 ? `…${s.slice(-4)}` : s);

console.log(`Enable Banking spike · App ID ${APP_ID}`);
const key = await importKey();
jwt = await makeJwt(key);

// (0) az alkalmazás
const app = await call('GET', '/application');
show(`GET /application → ${app.status}`, app.status === 200 ? { name: app.json.name, environment: app.json.environment, active: app.json.active, redirect_urls: app.json.redirect_urls, services: app.json.services, countries: app.json.countries } : app.json);
if (app.status !== 200) process.exit(1);
const prod = app.json.environment === 'PRODUCTION';
const redact = prod || flag('redact');
if (redact) console.log('· redaktált mód: csak szerkezet és darabszám íródik ki, összeg / név / kereskedő / számlaszám SOHA');

// (2)(3) az ASPSP-lista: magyar bankok + bankonkénti max. hozzáférés-hossz
for (const country of ['HU']) {
  const r = await call('GET', `/aspsps?country=${country}`);
  console.log(`\n── GET /aspsps?country=${country} → ${r.status}`);
  if (r.status === 200) {
    const list = r.json.aspsps ?? [];
    console.log(`  ${list.length} ASPSP`);
    for (const a of list) console.log(`  · ${a.name} (${a.country}) · max hozzáférés: ${a.maximum_consent_validity ? Math.round(a.maximum_consent_validity / 86400) + ' nap' : '?'} · sandbox:${a.sandbox ?? false} · psu: ${(a.psu_types ?? []).join('/')} · auth: ${(a.auth_methods ?? []).map((m) => m.name).join('/')}`);
  } else console.log(JSON.stringify(r.json));
}
const all = await call('GET', '/aspsps');
if (all.status === 200) {
  const list = all.json.aspsps ?? [];
  console.log(`\n── GET /aspsps (minden ország) → ${list.length} ASPSP; sandbox-os: ${list.filter((a) => a.sandbox).map((a) => `${a.name}/${a.country}`).slice(0, 12).join(', ') || '—'}`);
  console.log(`  Mock ASPSP a listában: ${list.filter((a) => /mock/i.test(a.name)).map((a) => `${a.name}/${a.country}`).join(', ') || 'nincs'}`);
}

const search = opt('search');
if (search && all.status === 200) {
  const re = new RegExp(search, 'i');
  const hits = (all.json.aspsps ?? []).filter((a) => re.test(a.name));
  console.log(`
── ASPSP-keresés /${search}/i → ${hits.length} találat`);
  for (const a of hits) console.log(`  · ${a.name} (${a.country}) · max ${a.maximum_consent_validity ? Math.round(a.maximum_consent_validity / 86400) + ' nap' : '?'} · sandbox:${a.sandbox ?? false} · beta:${a.beta ?? false}`);
}

if (!flag('auth') && !opt('finish')) { console.log('\n(Az összekötéshez futtasd --auth kapcsolóval.)'); process.exit(0); }

// (1)(6) összekötés: POST /auth → böngésző → callback (helyi figyelő VAGY --finish) → POST /sessions
const redirectUrl = opt('redirect', (app.json.redirect_urls ?? []).find((u) => (prod ? u.startsWith('https://') : u.startsWith('http://localhost'))));
if (!redirectUrl) { console.error('✖ nincs illő redirect_url az alkalmazásban (--redirect <url>)'); process.exit(2); }
let code;

if (opt('finish')) {
  const saved = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const u = new URL(opt('finish'));
  if (u.pathname !== '/bank/callback') throw new Error('az URL nem a /bank/callback címre mutat');
  if (u.searchParams.get('error')) throw new Error(`a bank/Enable hibát adott: ${u.searchParams.get('error')} ${u.searchParams.get('error_description') ?? ''}`);
  if (u.searchParams.get('state') !== saved.state) throw new Error('a state NEM egyezik (CSRF-védelem működik)');
  console.log('· state egyezik ✔');
  code = u.searchParams.get('code');
} else {
  const aspspName = opt('aspsp', 'Mock ASPSP');
  const aspspCountry = opt('country', 'HU');
  const state = randomUUID();
  const started = await call('POST', '/auth', {
    access: { valid_until: new Date(Date.now() + 10 * 86400_000).toISOString() },
    aspsp: { name: aspspName, country: aspspCountry },
    state,
    redirect_url: redirectUrl,
    psu_type: 'personal',
  });
  show(`POST /auth (${aspspName}/${aspspCountry}, redirect ${redirectUrl}) → ${started.status}`, started.status === 200 ? { authorization_id: started.json.authorization_id, url: started.json.url } : started.json);
  if (started.status !== 200) process.exit(1);
  writeFileSync(STATE_FILE, JSON.stringify({ state, authorization_id: started.json.authorization_id, at: Date.now() }));
  console.log(`\n▶ NYISD MEG a böngészőben: ${started.json.url}`);
  if (!redirectUrl.startsWith('http://localhost:3000/')) {
    // nem a helyi gép: a visszairányítás a deploy-olt címre megy (a 404-oldal nem baj, a code a címsorban van)
    console.log(`\n(jóváhagyás után másold ki a böngésző címsorából az átirányított URL-t, és futtasd:\n   node scripts/enable-spike.mjs --key ${keyFile} --finish "<URL>")`);
    process.exit(0);
  }

  code = await new Promise((resolve) => {
    const timer = setTimeout(() => { server.close(); console.error('✖ időtúllépés: nem érkezett callback'); process.exit(1); }, Number(opt('wait', '300')) * 1000);
    const server = createServer((req, res) => {
      const u = new URL(req.url, 'http://localhost:3000');
      if (u.pathname !== '/bank/callback') { res.writeHead(404).end('nincs'); return; }
      console.log(`\n· callback megérkezett: paraméterek: ${[...u.searchParams.keys()].join(', ')}`);
      res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Kesz - bezarhatod ezt a lapot.');
      clearTimeout(timer); server.close();
      if (u.searchParams.get('error')) { console.error(`✖ a bank/Enable hibát adott: ${u.searchParams.get('error')}`); process.exit(1); }
      if (u.searchParams.get('state') !== state) { console.error('✖ a state NEM egyezik (CSRF-védelem működik)'); process.exit(1); }
      console.log('· state egyezik ✔');
      resolve(u.searchParams.get('code'));
    });
    server.on('error', (e) => {
      clearTimeout(timer);
      console.error(`\n✖ a :3000 port nem használható (${e.code}). Jóváhagyás után másold ki a böngésző címsorából az átirányított URL-t, és futtasd:\n   node scripts/enable-spike.mjs --finish "<URL>"`);
      process.exit(3);
    });
    server.listen(3000);
    console.log(`  (a jóváhagyás után a böngésző a ${redirectUrl} címre ugrik; a script itt fogja — ${opt('wait', '300')} mp-ig vár)`);
  });
}

jwt = await makeJwt(key);
const session = await call('POST', '/sessions', { code });
if (session.status !== 200) { show(`POST /sessions → ${session.status}`, session.json); process.exit(1); }
const s = session.json;
show(`POST /sessions → 200 (szerkezet; értékek maszkolva${redact ? ', név/számlaszám nélkül' : ''})`, {
  session_id: mask(s.session_id), shape: shape({ ...s, session_id: '', accounts: s.accounts }), aspsp: s.aspsp, psu_type: s.psu_type, access: s.access,
  accounts: (s.accounts ?? []).map((a) => ({
    keys: Object.keys(a), uid: mask(a.uid), currency: a.currency, cash_account_type: a.cash_account_type, psu_status: a.psu_status, usage: a.usage,
    has_iban: Boolean(a.account_id?.iban), other_scheme: a.account_id?.other?.scheme_name ?? null, id_hashes: (a.identification_hashes ?? []).length,
    ...(redact ? {} : { name: a.name, details: a.details }),
  })),
});

const fromDays = Number(opt('days', '30'));
const from = new Date(Date.now() - fromDays * 86400_000).toISOString().slice(0, 10);
const nonNull = (list) => { const c = {}; for (const t of list) for (const [k, v] of Object.entries(t)) if (v !== null && v !== undefined) c[k] = (c[k] ?? 0) + 1; return c; };
const tally = (list, f) => list.reduce((c, t) => { const k = f(t) ?? '∅'; c[k] = (c[k] ?? 0) + 1; return c; }, {});

for (const a of s.accounts ?? []) {
  const uid = a.uid ?? a;
  const bal = await call('GET', `/accounts/${uid}/balances`);
  console.log(`\n── GET /accounts/…${mask(uid)}/balances → ${bal.status}: ${bal.status === 200 ? shape(bal.json) : JSON.stringify(bal.json)}`);
  if (bal.status === 200) console.log(`  · balance_type-ok: ${(bal.json.balances ?? []).map((b) => `${b.balance_type}/${b.balance_amount?.currency}${redact ? '' : ` ${b.balance_amount?.amount}`}`).join(', ')}`);

  // lapozás: minden oldalt végigjárunk (max. 10), hogy a continuation_key működése és az oldalak közti ismétlődés látszódjon
  const all = [];
  let ck = null;
  for (let page = 1; page <= 10; page++) {
    const q = `/accounts/${uid}/transactions?date_from=${from}&transaction_status=BOOK${ck ? `&continuation_key=${encodeURIComponent(ck)}` : ''}`;
    const tx = await call('GET', q);
    console.log(`── GET …/transactions?date_from=${from}&transaction_status=BOOK${ck ? '&continuation_key=…' : ''} → ${tx.status}`);
    if (tx.status !== 200) { console.log(JSON.stringify(tx.json)); break; }
    const list = tx.json.transactions ?? [];
    console.log(`  ${page}. oldal: ${list.length} tétel · continuation_key: ${tx.json.continuation_key ? 'van' : 'nincs'}${page === 1 && list.length ? ` · szerkezet: ${shape(list[0])}` : ''}`);
    all.push(...list);
    ck = tx.json.continuation_key ?? null;
    if (!ck) break;
  }
  if (all.length) {
    const refs = all.map((t) => t.entry_reference).filter(Boolean);
    const ids = all.map((t) => t.transaction_id).filter(Boolean);
    const dates = all.map((t) => t.booking_date).filter(Boolean).sort();
    console.log(`  összesen ${all.length} tétel · booking_date: ${dates[0]} … ${dates[dates.length - 1]}`);
    console.log(`  · entry_reference: ${refs.length} db, egyedi: ${new Set(refs).size} · transaction_id: ${ids.length} db, egyedi: ${new Set(ids).size}`);
    console.log(`  · credit_debit_indicator: ${JSON.stringify(tally(all, (t) => t.credit_debit_indicator))} · status: ${JSON.stringify(tally(all, (t) => t.status))} · pénznem: ${JSON.stringify(tally(all, (t) => t.transaction_amount?.currency))}`);
    console.log(`  · nem-null mezők (darab): ${JSON.stringify(nonNull(all))}`);
    console.log(`  · remittance_information-tömb hossza: ${JSON.stringify(tally(all, (t) => (t.remittance_information ?? []).length))} · creditor.name van: ${all.filter((t) => t.creditor?.name).length} · debtor.name van: ${all.filter((t) => t.debtor?.name).length} · MCC van: ${all.filter((t) => t.merchant_category_code).length}`);
    if (!redact) for (const t of all.slice(0, 3)) console.log(`  · ${JSON.stringify({ entry_reference: t.entry_reference, transaction_id: t.transaction_id, amount: t.transaction_amount, cd: t.credit_debit_indicator, status: t.status, booking_date: t.booking_date, value_date: t.value_date, transaction_date: t.transaction_date, creditor: t.creditor, debtor: t.debtor, remittance_information: t.remittance_information, mcc: t.merchant_category_code })}`);
  }
}

if (!flag('keep')) {
  const del = await call('DELETE', `/sessions/${s.session_id}`);
  console.log(`\n── DELETE /sessions/… → ${del.status} ${JSON.stringify(del.json)}`);
}
console.log('\n✔ spike lefutott');

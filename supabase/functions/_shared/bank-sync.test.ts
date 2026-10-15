import { assert, assertEquals } from 'jsr:@std/assert@1';
import { EnableError, mapTransactions, type EnableApi, type EnableTransaction } from './enable.ts';
import { merchantKey } from './merchant.ts';
import { runBankSync, syncAccounts, syncConnection, syncWindowStart, type ConnRow, type IngestSummary, type SyncDb } from './bank-sync.ts';

const CONN = '33333333-3333-4333-8333-333333333333';
const NOW = new Date('2026-10-15T12:00:00.000Z');
const IBAN = 'HU93123456789012345678900001';
const SECRETNAME = 'Teszt Elek';

const conn = (over: Partial<ConnRow> = {}): ConnRow => ({
  id: CONN, user_id: 'u1', status: 'active', last_success_at: null,
  accounts: [
    { uid: 'uid-huf', identification_hash: 'h1', currency: 'HUF', cash_account_type: 'CACC', sync_enabled: true },
    { uid: 'uid-usd', identification_hash: 'h1', currency: 'USD', cash_account_type: 'CACC', sync_enabled: true },
    { uid: 'uid-sav', identification_hash: 'h3', currency: 'HUF', cash_account_type: 'SVGS', sync_enabled: false },
  ], ...over,
});
const tx = (ref: string, amount = '1500.00', dir = 'DBIT', name = 'Tesco Expressz'): EnableTransaction => ({
  entry_reference: ref, transaction_id: null, booking_date: '2026-10-14', transaction_amount: { amount, currency: 'HUF' }, credit_debit_indicator: dir,
  creditor: dir === 'DBIT' ? { name } : null, debtor: dir === 'CRDT' ? { name } : null, remittance_information: ['Kartyas vasarlas'],
});

function rig(o: { pages?: Record<string, Array<{ transactions: EnableTransaction[]; continuationKey: string | null }>>; reserve?: string; enableErr?: number; ingestErr?: boolean; due?: ConnRow[]; getConn?: ConnRow | null } = {}) {
  const log = { listed: [] as Array<{ uid: string; from: string; key: string | null }>, ingested: [] as Array<{ ref: string; rows: unknown[] }>, finished: [] as Array<{ ok: boolean; error: string | null; expire: boolean }>, reserved: [] as string[] };
  const seen: Record<string, number> = {};
  const enable: EnableApi = {
    listAspsps: () => Promise.resolve([]), startAuth: () => Promise.reject(new Error('no')), createSession: () => Promise.reject(new Error('no')), deleteSession: () => Promise.resolve(),
    listTransactions: (uid, from, key) => {
      log.listed.push({ uid, from, key: key ?? null });
      if (o.enableErr !== undefined) return Promise.reject(new EnableError(o.enableErr, 'transactions'));
      const pages = o.pages?.[uid] ?? [{ transactions: [], continuationKey: null }];
      const i = seen[uid] = (seen[uid] ?? -1) + 1;
      return Promise.resolve(pages[Math.min(i, pages.length - 1)]);
    },
  };
  const db: SyncDb = {
    getConnection: () => Promise.resolve(o.getConn === undefined ? conn() : o.getConn),
    dueConnections: () => Promise.resolve(o.due ?? [conn()]),
    reserve: (id, source) => { log.reserved.push(`${id}:${source}`); return Promise.resolve({ status: o.reserve ?? 'queued' }); },
    ingest: (_id, ref, rows) => { if (o.ingestErr) return Promise.reject(new Error(`db password ${SECRETNAME}`)); log.ingested.push({ ref, rows }); return Promise.resolve({ inserted: rows.length, duplicates: 0, skipped: 0, credits: 0, paid: 1, linked: 0, contributions: 0, expenses: rows.length - 1 } as IngestSummary); },
    finish: (_id, ok, error, expire) => { log.finished.push({ ok, error, expire }); return Promise.resolve(); },
  };
  return { deps: { enable, db, now: () => NOW }, log };
}

async function captured<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const orig = console.error; const lines: string[] = [];
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try { return { result: await fn(), logs: lines.join('\n') }; } finally { console.error = orig; }
}

Deno.test('mapTransactions: az A-40 leletek — pozitív összeg-string, irány a DBIT/CRDT-ből, entry_reference, ellenfél irány szerint, kulcs normalizálva', () => {
  const rows = mapTransactions([
    tx('T1', '4500.00', 'DBIT', 'Tesco Expressz'),
    { ...tx('T2', '400000.00', 'CRDT', 'Munkáltató Kft.'), creditor: { name: 'ennek nem szabad kelleni' } },
    { ...tx('', '10.5', 'DBIT'), entry_reference: null, transaction_id: 'TID-9' },
    { ...tx('T4', '-250', 'DBIT'), remittance_information: ['a', 'b'] },
    { ...tx('T5'), booking_date: null, value_date: '2026-10-13' },
    { ...tx('T6'), creditor: null, remittance_information: ['Netflix elofizetes'] },
  ], merchantKey);
  assertEquals(rows.length, 6);
  assertEquals(rows[0], { ref: 'T1', booked_on: '2026-10-14', amount: '4500.00', currency: 'HUF', direction: 'debit', counterparty: 'Tesco Expressz', remittance: 'Kartyas vasarlas', merchant_key: 'tesco expressz' });
  assertEquals([rows[1].direction, rows[1].counterparty, rows[1].merchant_key], ['credit', 'Munkáltató Kft.', 'munkaltato kft'], 'a jóváírás ellenfele a debtor');
  assertEquals(rows[2].ref, 'TID-9', 'entry_reference híján a transaction_id');
  assertEquals([rows[3].amount, rows[3].remittance], ['250', 'a b'], 'az előjel nem kerül az összegbe; a közlemény összefűzve');
  assertEquals(rows[4].booked_on, '2026-10-13', 'booking_date híján a value_date');
  assertEquals([rows[5].counterparty, rows[5].merchant_key], [null, 'netflix elofizetes'], 'név híján a közlemény adja a kulcsot');
  assertEquals(typeof rows[0].amount, 'string', 'H9: az összeg nem lehet JS-szám');
});

Deno.test('mapTransactions: az érvénytelen tételek kimaradnak (nincs összeg/pénznem/dátum/irány)', () => {
  const bad: EnableTransaction[] = [
    { ...tx('B1'), transaction_amount: { amount: 'abc', currency: 'HUF' } }, { ...tx('B2'), transaction_amount: { amount: '5', currency: 'FORINT' } },
    { ...tx('B3'), booking_date: '2026/10/14', value_date: null }, { ...tx('B4'), credit_debit_indicator: 'XXXX' }, { ...tx('B5'), transaction_amount: undefined },
    { ...tx('B6'), transaction_amount: { amount: '1e6', currency: 'HUF' } },
  ];
  assertEquals(mapTransactions(bad, merchantKey), []);
  assertEquals(mapTransactions(undefined, merchantKey), []);
});

Deno.test('syncAccounts / syncWindowStart: csak a követett számlák, hash:pénznem kulcs; az ablak az utolsó siker −3 nap, legfeljebb 90 nap', () => {
  assertEquals(syncAccounts(conn().accounts), [{ uid: 'uid-huf', ref: 'h1:HUF' }, { uid: 'uid-usd', ref: 'h1:USD' }]);
  assertEquals(syncAccounts([{ uid: 'u', identification_hash: 'h', currency: 'HUF' }]), [{ uid: 'u', ref: 'h:HUF' }], 'hiányzó sync_enabled = követett');
  assertEquals(syncAccounts([{ uid: 'u', currency: 'HUF' }, 'x', null]), []);
  assertEquals(syncAccounts(null), []);
  assertEquals(syncWindowStart(null, NOW), '2026-07-17', 'első szinkron: 90 nap');
  assertEquals(syncWindowStart('2026-10-14T03:40:00Z', NOW), '2026-10-11', 'utolsó siker − 3 nap');
  assertEquals(syncWindowStart('2025-01-01T00:00:00Z', NOW), '2026-07-17', 'a 90 napnál régebbi sikert nem követi');
  assertEquals(syncWindowStart('nem-datum', NOW), '2026-07-17');
});

Deno.test('syncConnection: csak a követett számlák, lapozás a continuation_key-vel, számlánként EGY ingest, az ablak a kapcsolat utolsó sikeréből', async () => {
  const { deps, log } = rig({ pages: {
    'uid-huf': [{ transactions: [tx('A1'), tx('A2')], continuationKey: 'k2' }, { transactions: [tx('A3')], continuationKey: null }],
    'uid-usd': [{ transactions: [tx('U1', '10.00')], continuationKey: null }],
  } });
  const out = await syncConnection(deps, conn({ last_success_at: '2026-10-14T03:40:00Z' }));
  assertEquals(out.ok, true);
  assertEquals(log.listed.map((l) => `${l.uid}:${l.key}`), ['uid-huf:null', 'uid-huf:k2', 'uid-usd:null'], 'a megtakarítási (nem követett) számlát lekérdezte / a lapozás hibás');
  assert(log.listed.every((l) => l.from === '2026-10-11'), 'az ablak kezdete hibás');
  assertEquals(log.ingested.map((i) => [i.ref, i.rows.length]), [['h1:HUF', 3], ['h1:USD', 1]], 'számlánként egy ingest, minden oldal együtt');
  assertEquals(log.finished, [{ ok: true, error: null, expire: false }]);
  if (out.ok) assertEquals([out.summary.inserted, out.summary.paid, out.summary.expenses], [4, 2, 2], 'az összesítés számlánként összeadódik');
});

Deno.test('syncConnection: a lapozás legfeljebb 10 oldal; üres számla nem hív ingest-et; nincs követett számla → siker', async () => {
  const endless = { transactions: [tx('E1')], continuationKey: 'again' };
  const { deps, log } = rig({ pages: { 'uid-huf': [endless] } });
  await syncConnection(deps, conn());
  assertEquals(log.listed.filter((l) => l.uid === 'uid-huf').length, 10, 'a lapozás nem korlátos');
  assertEquals(log.ingested.map((i) => i.ref), ['h1:HUF'], 'az üres USD-számla ingest-et hívott');
  const none = rig();
  assertEquals((await syncConnection(none.deps, conn({ accounts: [] }))).ok, true);
  assertEquals(none.log.finished, [{ ok: true, error: null, expire: false }]);
});

Deno.test('syncConnection: hibák — 401/403/422 → expired (lejárat jelezve), 429 → nincs újrapróba, 5xx/hálózat → upstream, DB-hiba → error; mindig lezárja a futást', async () => {
  for (const [status, reason, expire] of [[401, 'expired', true], [403, 'expired', true], [422, 'expired', true], [429, 'rate_limited', false], [500, 'upstream', false], [503, 'upstream', false], [0, 'upstream', false]] as const) {
    const { deps, log } = rig({ enableErr: status });
    const out = await captured(() => syncConnection(deps, conn()));
    assertEquals(out.result, { ok: false, reason }, String(status));
    assertEquals(log.finished, [{ ok: false, error: reason, expire }], `${status}: a lezárás hibás`);
    assertEquals(log.listed.length, 1, `${status}: hiba után is tovább hívta a bankot`);
  }
  const dbErr = rig({ ingestErr: true, pages: { 'uid-huf': [{ transactions: [tx('A1')], continuationKey: null }] } });
  const r = await captured(() => syncConnection(dbErr.deps, conn()));
  assertEquals(r.result, { ok: false, reason: 'error' });
  assertEquals(dbErr.log.finished, [{ ok: false, error: 'error', expire: false }]);
  assert(!r.logs.includes(SECRETNAME) && !r.logs.includes('password'), 'a DB-hiba szövege bekerült a naplóba: ' + r.logs);
});

Deno.test('runBankSync (egy kapcsolat): foglalás nélkül foglal; nem sorba állított foglalásnál NEM hív bankot; a már foglalt (reserved) nem foglal újra; ismeretlen/inaktív → not_found', async () => {
  const a = rig();
  const r1 = await runBankSync(a.deps, { connection_id: CONN, source: 'manual' });
  assertEquals(a.log.reserved, [`${CONN}:manual`]);
  assertEquals(r1.body.status, 'synced');
  for (const status of ['too_soon', 'daily_limit', 'not_active']) {
    const b = rig({ reserve: status });
    const r = await runBankSync(b.deps, { connection_id: CONN, source: 'manual' });
    assertEquals([r.status, r.body], [200, { ok: true, status }]);
    assertEquals(b.log.listed.length, 0, `${status}: a foglalás ellenére bankot hívott`);
  }
  const c = rig();
  await runBankSync(c.deps, { connection_id: CONN, source: 'auto', reserved: true });
  assertEquals(c.log.reserved, [], 'a már foglalt kérés újra foglalt (dupla plafon-fogyasztás)');
  assertEquals(c.log.listed.length > 0, true);
  for (const bad of [rig({ getConn: null }), rig({ getConn: conn({ status: 'revoked' }) })]) {
    assertEquals((await runBankSync(bad.deps, { connection_id: CONN, source: 'auto' })).body, { ok: false, code: 'not_found' });
    assertEquals(bad.log.listed.length, 0);
  }
  assertEquals((await runBankSync(rig().deps, { connection_id: 'nem-uuid', source: 'auto' })).status, 404);
  const failed = await captured(() => runBankSync(rig({ enableErr: 500 }).deps, { connection_id: CONN, source: 'auto', reserved: true }));
  assertEquals(failed.result.body, { ok: true, status: 'failed', reason: 'upstream' });
});

Deno.test('runBankSync (napi cron): minden esedékes kapcsolat, kapcsolatonként foglalással; a nem foglalt kihagyva; egy hiba nem állítja meg a többit', async () => {
  const c2 = conn({ id: '44444444-4444-4444-8444-444444444444' });
  const { deps, log } = rig({ due: [conn(), c2] });
  const r = await runBankSync(deps, { source: 'auto' });
  assertEquals(r.body, { ok: true, status: 'done', synced: 2, failed: 0, skipped: 0 });
  assertEquals(log.reserved, [`${CONN}:auto`, `${c2.id}:auto`]);
  const skip = rig({ due: [conn()], reserve: 'too_soon' });
  assertEquals((await runBankSync(skip.deps, { source: 'auto' })).body, { ok: true, status: 'done', synced: 0, failed: 0, skipped: 1 });
  assertEquals(skip.log.listed.length, 0, 'a nem foglalt kapcsolatot is szinkronizálta');
  const bad = rig({ due: [conn(), c2], enableErr: 500 });
  assertEquals((await captured(() => runBankSync(bad.deps, { source: 'auto' }))).result.body, { ok: true, status: 'done', synced: 0, failed: 2, skipped: 0 });
});

Deno.test('a naplóban és a válaszban nincs összeg, név, számlaszám, referencia', async () => {
  const rows = { 'uid-huf': [{ transactions: [{ ...tx('REF-SECRET-1', '98765.43', 'DBIT', SECRETNAME), remittance_information: [IBAN] }], continuationKey: null }] };
  const ok = await captured(() => runBankSync(rig({ pages: rows }).deps, { connection_id: CONN, source: 'auto', reserved: true }));
  const fl = await captured(() => runBankSync(rig({ pages: rows, enableErr: 403 }).deps, { connection_id: CONN, source: 'auto', reserved: true }));
  for (const text of [JSON.stringify(ok.result.body), ok.logs, JSON.stringify(fl.result.body), fl.logs]) {
    for (const s of ['REF-SECRET-1', '98765', SECRETNAME, IBAN, 'uid-huf', 'h1']) assert(!text.includes(s), `szivárog: ${s} → ${text.slice(0, 160)}`);
  }
});

Deno.test('a túl nagy köteg 2000 sorra csonkolódik, és a naplóba csak a darabszám kerül (nincs tételtartalom)', async () => {
  const many = Array.from({ length: 2001 }, (_, i) => tx(`BIG-${i}`, '10.00', 'DBIT', SECRETNAME));
  const { deps, log } = rig({ pages: { 'uid-huf': [{ transactions: many, continuationKey: null }] } });
  const r = await captured(() => syncConnection(deps, conn()));
  assertEquals(r.result.ok, true);
  assertEquals(log.ingested[0].rows.length, 2000);
  assert(r.logs.includes('sync_rows_capped') && !r.logs.includes(SECRETNAME) && !r.logs.includes('BIG-0'), 'a napló hibás: ' + r.logs.slice(0, 200));
});

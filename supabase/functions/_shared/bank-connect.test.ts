import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { DbError, disconnect, finishConnection, listAspsps, startConnection, type BankDb, type BankDeps } from './bank-connect.ts';
import { EnableError, type EnableApi, type EnableSession } from './enable.ts';

const USER = '11111111-1111-4111-8111-111111111111';
const CONN = '22222222-2222-4222-8222-222222222222';
const NOW = new Date('2026-10-15T12:00:00.000Z');
const IBAN = 'HU93123456789012345678900001';
const CODE = 'code-AAAA-1111-secret';
const STATE = 'state-BBBB-2222-secret';
const SESSION = 'sess-CCCC-3333-secret';

const bank: { name: string; country: string; maxConsentDays: number | null; personal: boolean } = { name: 'Revolut', country: 'HU', maxConsentDays: 180, personal: true };
const session = (over: Partial<EnableSession> = {}): EnableSession => ({
  session_id: SESSION, aspsp: { name: 'Revolut', country: 'HU' }, access: { valid_until: '2027-04-13T12:00:00Z' },
  accounts: [{ uid: 'u1', identification_hash: 'h1', currency: 'HUF', cash_account_type: 'CACC', account_id: { iban: IBAN } }], ...over,
});

// ── mock-Enable és mock-DB, hívás-naplóval
function rig(o: { allowed?: boolean; banks?: typeof bank[]; session?: EnableSession; consume?: 'ok' | 'invalid' | 'expired'; renew?: string | null;
                  startErr?: string; enableFail?: Partial<Record<'aspsps' | 'auth' | 'sessions' | 'delete', number>>; finishErr?: string; oldSessions?: string[]; revokeSession?: string | null; appBase?: string | null } = {}) {
  const calls: string[] = [];
  const sent: { auth?: Record<string, unknown>; start?: { state: string; renew: string | null }; finish?: Record<string, unknown>; deleted: string[] } = { deleted: [] };
  const enable: EnableApi = {
    listAspsps: (c) => { calls.push('enable.aspsps'); if (o.enableFail?.aspsps) return Promise.reject(new EnableError(o.enableFail.aspsps, 'aspsps')); return Promise.resolve((o.banks ?? [bank]).filter((b) => b.country === c)); },
    startAuth: (a) => { calls.push('enable.auth'); sent.auth = a; if (o.enableFail?.auth) return Promise.reject(new EnableError(o.enableFail.auth, 'auth')); return Promise.resolve({ url: 'https://tilisy.test/start' }); },
    createSession: () => { calls.push('enable.sessions'); if (o.enableFail?.sessions) return Promise.reject(new EnableError(o.enableFail.sessions, 'sessions')); return Promise.resolve(o.session ?? session()); },
    deleteSession: (id) => { calls.push('enable.delete'); sent.deleted.push(id); if (o.enableFail?.delete) return Promise.reject(new EnableError(o.enableFail.delete, 'delete_session')); return Promise.resolve(); },
  };
  const db: BankDb = {
    bankSyncAllowed: () => { calls.push('db.allowed'); return Promise.resolve(o.allowed ?? true); },
    startConnect: (_u, state, renew) => { calls.push('db.start'); if (o.startErr) return Promise.reject(new DbError(o.startErr)); sent.start = { state, renew }; return Promise.resolve(); },
    consumeState: () => { calls.push('db.consume'); return Promise.resolve({ status: o.consume ?? 'ok', renewConnectionId: o.renew ?? null }); },
    finishConnection: (a) => { calls.push('db.finish'); sent.finish = a as unknown as Record<string, unknown>; if (o.finishErr) return Promise.reject(new DbError(o.finishErr)); return Promise.resolve({ connectionId: CONN, oldSessionIds: o.oldSessions ?? [] }); },
    revokeConnection: () => { calls.push('db.revoke'); if (o.finishErr) return Promise.reject(new DbError(o.finishErr)); return Promise.resolve({ sessionId: o.revokeSession === undefined ? SESSION : o.revokeSession }); },
  };
  const deps: BankDeps = { enable, db, appBaseUrl: o.appBase === undefined ? 'https://bankreminder.vercel.app/' : o.appBase, now: () => NOW, randomState: () => 'random-state-0001' };
  return { deps, calls, sent };
}

// a naplót elfogjuk: se code/state/session/IBAN/titok nem lehet benne
async function captured<T>(fn: () => Promise<T>): Promise<{ result: T; logs: string }> {
  const orig = console.error; const lines: string[] = [];
  console.error = (...a: unknown[]) => { lines.push(a.map(String).join(' ')); };
  try { return { result: await fn(), logs: lines.join('\n') }; } finally { console.error = orig; }
}
const clean = (text: string, ...extra: string[]) => {
  for (const s of [CODE, STATE, SESSION, IBAN, 'ENABLE_PRIVATE_KEY', 'PRIVATE KEY', ...extra]) assert(!text.includes(s), `szivárog: ${s} → ${text.slice(0, 200)}`);
};

Deno.test('bank_sync_allowed = false → 403 not_allowed, az Enable-t NEM hívja (list/start/finish)', async () => {
  for (const [name, run] of [
    ['list', (d: BankDeps) => listAspsps(d, USER, { country: 'HU' })],
    ['start', (d: BankDeps) => startConnection(d, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })],
    ['finish', (d: BankDeps) => finishConnection(d, USER, { code: CODE, state: STATE })],
  ] as const) {
    const { deps, calls } = rig({ allowed: false });
    const r = await run(deps);
    assertEquals([r.status, r.body], [403, { ok: false, code: 'not_allowed' }], name);
    assert(!calls.some((c) => c.startsWith('enable.')), `${name}: az Enable-t hívta: ${calls}`);
    assert(!calls.includes('db.start') && !calls.includes('db.consume') && !calls.includes('db.finish'), `${name}: írt az adatbázisba`);
  }
});

Deno.test('list-aspsps: csak személyes ügyféltípus, névsorban, max napokkal; országformátum ellenőrzött', async () => {
  const { deps } = rig({ banks: [{ ...bank, name: 'Zed', maxConsentDays: null }, { ...bank, name: 'Cég', personal: false }, bank, { ...bank, country: 'AT', name: 'Más' }] });
  const r = await listAspsps(deps, USER, { country: 'HU' });
  assertEquals(r.body, { ok: true, aspsps: [{ name: 'Revolut', country: 'HU', max_consent_days: 180 }, { name: 'Zed', country: 'HU', max_consent_days: null }] });
  assertEquals((await listAspsps(deps, USER, { country: "H'; DROP" })).body, { ok: false, code: 'unknown_bank' });
  assertEquals((await listAspsps(rig({ enableFail: { aspsps: 500 } }).deps, USER, {})).status, 502);
});

Deno.test('start: a bank maximumát kéri, pontos redirect-URL-t ad, https-URL-t ad vissza; state a DB-ben', async () => {
  const { deps, sent, calls } = rig();
  const r = await startConnection(deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' });
  assertEquals([r.status, r.body], [200, { ok: true, url: 'https://tilisy.test/start' }]);
  assertEquals(sent.auth?.redirectUrl, 'https://bankreminder.vercel.app/bank/callback', 'a redirect URL nem egyezik a regisztrálttal (záró per-jel!)');
  assertEquals(sent.auth?.validUntil, new Date(NOW.getTime() + 180 * 86_400_000).toISOString());
  assertEquals(sent.auth?.state, 'random-state-0001');
  assertEquals(sent.start?.state, 'random-state-0001', 'a DB-be más state került, mint az Enable-nek');
  assert(calls.indexOf('db.start') < calls.indexOf('enable.auth'), 'a state-et előbb el kell tárolni, mint hogy az Enable-nek elküldjük');
  // ha a bank nem közli a maximumot: 90 nap
  const r2 = rig({ banks: [{ ...bank, maxConsentDays: null }] });
  await startConnection(r2.deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' });
  assertEquals(r2.sent.auth?.validUntil, new Date(NOW.getTime() + 90 * 86_400_000).toISOString());
});

Deno.test('start: ismeretlen bank / rossz bemenet 400; nem-https URL az Enable-től → 502; DB-hibák leképezve; megújításnál a renew-id továbbmegy', async () => {
  assertEquals((await startConnection(rig().deps, USER, { aspsp_name: 'Nincs', aspsp_country: 'HU' })).body, { ok: false, code: 'unknown_bank' });
  assertEquals((await startConnection(rig({ banks: [{ ...bank, personal: false }] }).deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })).body, { ok: false, code: 'unknown_bank' });
  for (const bad of [{}, { aspsp_name: '', aspsp_country: 'HU' }, { aspsp_name: 'x', aspsp_country: 'hu' }, { aspsp_name: 'x'.repeat(101), aspsp_country: 'HU' }, { aspsp_name: 'Revolut', aspsp_country: 'HU', renew_connection_id: 'nem-uuid' }]) {
    assertEquals((await startConnection(rig().deps, USER, bad)).status, 400, JSON.stringify(bad));
  }
  const http = rig();
  http.deps.enable.startAuth = () => Promise.resolve({ url: 'http://evil.test/x' });
  assertEquals((await startConnection(http.deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })).status, 502);
  http.deps.enable.startAuth = () => Promise.resolve({ url: 'javascript:alert(1)' });
  assertEquals((await startConnection(http.deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })).status, 502);
  assertEquals((await startConnection(rig({ startErr: 'BR429' }).deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })).body, { ok: false, code: 'rate_limited' });
  assertEquals((await startConnection(rig({ startErr: 'BR404' }).deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU', renew_connection_id: CONN })).body, { ok: false, code: 'not_found' });
  assertEquals((await startConnection(rig({ enableFail: { auth: 500 } }).deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })).body, { ok: false, code: 'upstream_failed' });
  assertEquals((await startConnection(rig({ appBase: 'http://nem-https.test' }).deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })).status, 502);
  assertEquals((await startConnection(rig({ appBase: null }).deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' })).status, 502);
  const renew = rig();
  await startConnection(renew.deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU', renew_connection_id: CONN });
  assertEquals(renew.sent.start?.renew, CONN);
});

Deno.test('finish: a state-et ELŐBB elfogyasztja; érvénytelen/lejárt state mellett az Enable-t nem hívja (újrajátszás nem jut a bankig)', async () => {
  for (const [consume, code] of [['invalid', 'state_invalid'], ['expired', 'state_expired']] as const) {
    const { deps, calls } = rig({ consume });
    const r = await finishConnection(deps, USER, { code: CODE, state: STATE });
    assertEquals([r.status, r.body], [400, { ok: false, code }]);
    assert(!calls.includes('enable.sessions') && !calls.includes('db.finish'), `${consume}: az Enable-t/DB-t hívta: ${calls}`);
  }
  const ok = rig();
  await finishConnection(ok.deps, USER, { code: CODE, state: STATE });
  assert(ok.calls.indexOf('db.consume') < ok.calls.indexOf('enable.sessions'), 'előbb az Enable, aztán a state-fogyasztás');
  for (const bad of [{}, { code: CODE }, { state: STATE }, { code: 'rövid', state: STATE }, { code: CODE, state: 'x'.repeat(300) }, { code: CODE + ' ;', state: STATE }]) {
    const { deps, calls } = rig();
    assertEquals((await finishConnection(deps, USER, bad)).body, { ok: false, code: 'state_invalid' }, JSON.stringify(bad));
    assertEquals(calls, [], 'rossz alakú kérésnél semmi nem hívódhat');
  }
});

Deno.test('finish: sikeres összekötés — a számlák maszkoltak (nincs teljes IBAN), a lejárat a banktól jön, a válasz/napló tiszta', async () => {
  const { deps, sent } = rig({ renew: CONN, oldSessions: ['old-session-1'] });
  const { result: r, logs } = await captured(() => finishConnection(deps, USER, { code: CODE, state: STATE }));
  assertEquals([r.status, r.body], [200, { ok: true, connection_id: CONN }]);
  const f = sent.finish as Record<string, unknown>;
  assertEquals(f.renewConnectionId, CONN);
  assertEquals(f.sessionId, SESSION);
  assertEquals(f.validUntil, '2027-04-13T12:00:00.000Z', 'a lejárat nem a bank tényleges lejárata');
  assertEquals(f.authorizedAt, NOW.toISOString());
  assertEquals(f.accounts, [{ uid: 'u1', identification_hash: 'h1', currency: 'HUF', cash_account_type: 'CACC', iban_last4: '0001', name: null, sync_enabled: true }]);
  assert(!JSON.stringify(f.accounts).includes('HU93'), 'teljes IBAN megy az adatbázisba');
  assertEquals(sent.deleted, ['old-session-1'], 'a lecserélt régi session nem törlődött az Enable-nél');
  clean(JSON.stringify(r.body)); clean(logs);
});

Deno.test('finish: használhatatlan session (nincs számla / lejárt / hiányzó bank) → 502 és a session törlése; DB-hiba után is törli', async () => {
  for (const [name, s] of [['nincs számla', session({ accounts: [] })], ['múltbeli lejárat', session({ access: { valid_until: '2026-01-01T00:00:00Z' } })],
                           ['nincs lejárat', session({ access: {} })], ['nincs bank', session({ aspsp: {} })]] as const) {
    const { deps, calls, sent } = rig({ session: s });
    assertEquals((await finishConnection(deps, USER, { code: CODE, state: STATE })).body, { ok: false, code: 'upstream_failed' }, name);
    assert(!calls.includes('db.finish'), `${name}: használhatatlan session bekerült`);
    assertEquals(sent.deleted, [SESSION], `${name}: a session nem törlődött`);
  }
  const dbfail = rig({ finishErr: 'XX000' });
  assertEquals((await finishConnection(dbfail.deps, USER, { code: CODE, state: STATE })).status, 502);
  assertEquals(dbfail.sent.deleted, [SESSION], 'DB-hiba után nyilvántartás nélküli élő hozzáférés maradt');
  assertEquals((await finishConnection(rig({ finishErr: 'BR404' }).deps, USER, { code: CODE, state: STATE })).body, { ok: false, code: 'not_found' });
  assertEquals((await finishConnection(rig({ enableFail: { sessions: 400 } }).deps, USER, { code: CODE, state: STATE })).body, { ok: false, code: 'upstream_failed' });
  // a régi session törlésének hibája nem akadályozza az összekötést
  assertEquals((await finishConnection(rig({ oldSessions: ['o1', 'o2'], enableFail: { delete: 500 } }).deps, USER, { code: CODE, state: STATE })).status, 200);
});

Deno.test('disconnect: a bank_sync_allowed-től függetlenül megy; a session törlődik; hibás/idegen azonosító 404; az Enable-hiba nem akadályozza a helyi visszavonást', async () => {
  const { deps, calls, sent } = rig({ allowed: false });
  const r = await disconnect(deps, USER, { connection_id: CONN });
  assertEquals([r.status, r.body], [200, { ok: true, session_deleted: true }]);
  assertEquals(sent.deleted, [SESSION]);
  assert(!calls.includes('db.allowed'), 'a visszavonás a bank_sync_allowed-et vizsgálta');
  assertEquals((await disconnect(rig().deps, USER, { connection_id: 'nem-uuid' })).body, { ok: false, code: 'not_found' });
  assertEquals((await disconnect(rig().deps, USER, {})).status, 404);
  assertEquals((await disconnect(rig({ finishErr: 'BR404' }).deps, USER, { connection_id: CONN })).body, { ok: false, code: 'not_found' });
  const gone = await captured(() => disconnect(rig({ enableFail: { delete: 500 } }).deps, USER, { connection_id: CONN }));
  assertEquals(gone.result.body, { ok: true, session_deleted: false });
  clean(gone.logs);
  const again = rig({ revokeSession: null });   // már visszavont: nincs session
  assertEquals((await disconnect(again.deps, USER, { connection_id: CONN })).body, { ok: true, session_deleted: false });
  assertEquals(again.sent.deleted, []);
});

Deno.test('a naplóban hiba esetén sincs code/state/session/IBAN (Enable-hibák, DB-hibák)', async () => {
  const { logs } = await captured(async () => {
    await finishConnection(rig({ enableFail: { sessions: 500 } }).deps, USER, { code: CODE, state: STATE });
    await finishConnection(rig({ finishErr: 'XX000' }).deps, USER, { code: CODE, state: STATE });
    await finishConnection(rig({ session: session({ accounts: [] }) }).deps, USER, { code: CODE, state: STATE });
    await finishConnection(rig({ oldSessions: ['o1'], enableFail: { delete: 500 } }).deps, USER, { code: CODE, state: STATE });
    await startConnection(rig({ enableFail: { auth: 403 } }).deps, USER, { aspsp_name: 'Revolut', aspsp_country: 'HU' });
    await disconnect(rig({ enableFail: { delete: 500 } }).deps, USER, { connection_id: CONN });
  });
  assertStringIncludes(logs, 'enable_failed');
  clean(logs);
});

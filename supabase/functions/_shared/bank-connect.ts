// A bank-összekötés kezelői (A-47): list-aspsps · bank-connect-start · bank-connect-finish · bank-disconnect.
// Tiszta függvények injektált függőségekkel (Enable-kliens, adatbázis) → mock-Enable-lel tesztelhetők. A válaszokban és a naplóban
// NINCS titok, PII, code/state, session-azonosító vagy teljes IBAN. Szerződés: docs/CONTRACT_CHANGES.md „B-41: a bank-hívások…".
import { EnableError, mapAccounts, type EnableApi } from './enable.ts';

export type BankErrorCode = 'unauthenticated' | 'not_allowed' | 'unknown_bank' | 'state_invalid' | 'state_expired' | 'rate_limited' | 'upstream_failed' | 'not_found';
export interface Result { status: number; body: Record<string, unknown> }

const HTTP: Record<BankErrorCode, number> = {
  unauthenticated: 401, not_allowed: 403, unknown_bank: 400, state_invalid: 400, state_expired: 400, rate_limited: 429, upstream_failed: 502, not_found: 404,
};
export const fail = (code: BankErrorCode): Result => ({ status: HTTP[code], body: { ok: false, code } });
const ok = (extra: Record<string, unknown> = {}): Result => ({ status: 200, body: { ok: true, ...extra } });

/** Adatbázis-hiba, amit a függvények SQLSTATE-ből ismernek fel (BR404 / BR429) */
export class DbError extends Error { constructor(public code: string) { super(`db error ${code}`); } }

export interface BankDb {
  bankSyncAllowed(userId: string): Promise<boolean>;
  startConnect(userId: string, state: string, renewConnectionId: string | null): Promise<void>;
  consumeState(state: string, userId: string): Promise<{ status: 'ok' | 'invalid' | 'expired'; renewConnectionId: string | null }>;
  finishConnection(a: {
    userId: string; renewConnectionId: string | null; aspspName: string; aspspCountry: string; sessionId: string;
    accounts: Array<Record<string, unknown>>; authorizedAt: string; validUntil: string;
  }): Promise<{ connectionId: string; oldSessionIds: string[] }>;
  revokeConnection(userId: string, connectionId: string): Promise<{ sessionId: string | null }>;
  /** Az első szinkron sorba állítása az összekötés után (foglalás + bank-sync hívás); hibája nem akadályozza az összekötést */
  queueFirstSync(connectionId: string): Promise<void>;
}

export interface BankDeps {
  enable: EnableApi;
  db: BankDb;
  /** pl. https://bankreminder.vercel.app — az Enable-ben regisztrált redirect URL alapja (Production: csak https) */
  appBaseUrl: string | null;
  now: () => Date;
  randomState: () => string;
}

// PII-mentes napló: csak esemény + státusz/kód
const log = (event: string, fields: Record<string, unknown> = {}) => console.error(event, JSON.stringify(fields));

const TOKEN = /^[A-Za-z0-9._~-]{8,256}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTRY = /^[A-Z]{2}$/;
const DEFAULT_CONSENT_DAYS = 90;
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

const httpsUrl = (v: unknown): string | null => {
  if (typeof v !== 'string' || v.length > 2048) return null;
  try { const u = new URL(v); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; }
};

// ───────── list-aspsps ─────────
export async function listAspsps(deps: BankDeps, userId: string, body: Record<string, unknown>): Promise<Result> {
  const country = str(body.country) ?? 'HU';
  if (!COUNTRY.test(country)) return fail('unknown_bank');
  if (!(await deps.db.bankSyncAllowed(userId))) return fail('not_allowed');
  try {
    const list = await deps.enable.listAspsps(country);
    const aspsps = list
      .filter((a) => a.personal && a.country === country)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((a) => ({ name: a.name, country: a.country, max_consent_days: a.maxConsentDays }));
    return ok({ aspsps });
  } catch (e) { log('enable_failed', { op: 'aspsps', status: e instanceof EnableError ? e.status : 0 }); return fail('upstream_failed'); }
}

// ───────── bank-connect-start ─────────
export async function startConnection(deps: BankDeps, userId: string, body: Record<string, unknown>): Promise<Result> {
  const name = str(body.aspsp_name)?.trim() ?? '';
  const country = str(body.aspsp_country) ?? '';
  const renew = body.renew_connection_id === undefined || body.renew_connection_id === null ? null : str(body.renew_connection_id);
  if (name.length < 1 || name.length > 100 || !COUNTRY.test(country) || (renew !== null && !UUID.test(renew))) return fail('unknown_bank');
  if (!(await deps.db.bankSyncAllowed(userId))) return fail('not_allowed');
  const base = deps.appBaseUrl?.replace(/\/+$/, '') ?? '';
  if (!base.startsWith('https://')) { log('app_base_url_invalid'); return fail('upstream_failed'); }

  let max: number | null;
  try {
    const bank = (await deps.enable.listAspsps(country)).find((a) => a.name === name && a.country === country && a.personal);
    if (!bank) return fail('unknown_bank');
    max = bank.maxConsentDays;
  } catch (e) { log('enable_failed', { op: 'aspsps', status: e instanceof EnableError ? e.status : 0 }); return fail('upstream_failed'); }

  const state = deps.randomState();
  try { await deps.db.startConnect(userId, state, renew); }
  catch (e) {
    if (e instanceof DbError && e.code === 'BR404') return fail('not_found');
    if (e instanceof DbError && e.code === 'BR429') return fail('rate_limited');
    log('db_failed', { op: 'start' });
    return fail('upstream_failed');
  }

  // a bank maximumát kérjük (advanced.md §5.4); ha nem közli, 90 nap
  const validUntil = new Date(deps.now().getTime() + (max ?? DEFAULT_CONSENT_DAYS) * 86_400_000).toISOString();
  try {
    const started = await deps.enable.startAuth({ aspspName: name, aspspCountry: country, state, redirectUrl: `${base}/bank/callback`, validUntil });
    const url = httpsUrl(started.url);
    if (!url) { log('enable_bad_url'); return fail('upstream_failed'); }
    return ok({ url });
  } catch (e) { log('enable_failed', { op: 'auth', status: e instanceof EnableError ? e.status : 0 }); return fail('upstream_failed'); }
}

// ───────── bank-connect-finish ─────────
export async function finishConnection(deps: BankDeps, userId: string, body: Record<string, unknown>): Promise<Result> {
  const code = str(body.code) ?? '';
  const state = str(body.state) ?? '';
  if (!TOKEN.test(code) || !TOKEN.test(state)) return fail('state_invalid');
  if (!(await deps.db.bankSyncAllowed(userId))) return fail('not_allowed');

  // a state EGYSZER használható: előbb elfogyasztjuk, és csak utána hívjuk az Enable-t (újrajátszott kérés nem jut el a bankig)
  let consumed: Awaited<ReturnType<BankDb['consumeState']>>;
  try { consumed = await deps.db.consumeState(state, userId); }
  catch { log('db_failed', { op: 'consume' }); return fail('upstream_failed'); }
  if (consumed.status === 'invalid') return fail('state_invalid');
  if (consumed.status === 'expired') return fail('state_expired');

  let session: Awaited<ReturnType<EnableApi['createSession']>>;
  try { session = await deps.enable.createSession(code); }
  catch (e) { log('enable_failed', { op: 'sessions', status: e instanceof EnableError ? e.status : 0 }); return fail('upstream_failed'); }

  const dropSession = async () => { try { await deps.enable.deleteSession(session.session_id); } catch { log('session_cleanup_failed'); } };
  const accounts = mapAccounts(session.accounts);
  const validUntilMs = Date.parse(session.access?.valid_until ?? '');
  const nowMs = deps.now().getTime();
  const aspspName = session.aspsp?.name;
  const aspspCountry = session.aspsp?.country;
  if (!accounts.length || !Number.isFinite(validUntilMs) || validUntilMs <= nowMs || !aspspName || !aspspCountry || !COUNTRY.test(aspspCountry)) {
    log('session_unusable', { accounts: accounts.length });
    await dropSession();
    return fail('upstream_failed');
  }

  let saved: { connectionId: string; oldSessionIds: string[] };
  try {
    saved = await deps.db.finishConnection({
      userId, renewConnectionId: consumed.renewConnectionId, aspspName, aspspCountry, sessionId: session.session_id,
      accounts, authorizedAt: new Date(nowMs).toISOString(), validUntil: new Date(validUntilMs).toISOString(),
    });
  } catch (e) {
    await dropSession();   // nem maradhat felvétlen, nyilvántartás nélküli élő hozzáférés
    if (e instanceof DbError && e.code === 'BR404') return fail('not_found');
    log('db_failed', { op: 'finish' });
    return fail('upstream_failed');
  }

  // a lecserélt/visszavont korábbi session-ök törlése az Enable-nél (best effort: a hiba nem akadályozza az összekötést)
  for (const id of saved.oldSessionIds) {
    try { await deps.enable.deleteSession(id); } catch (e) { log('old_session_cleanup_failed', { status: e instanceof EnableError ? e.status : 0 }); }
  }
  // az első szinkron: a tételek az összekötés után azonnal megjelennek (a hiba csak naplóba kerül, az összekötés ettől még kész)
  try { await deps.db.queueFirstSync(saved.connectionId); } catch { log('first_sync_not_queued'); }
  return ok({ connection_id: saved.connectionId });
}

// ───────── bank-disconnect ─────────
// A kapcsolat törlése a bank_sync_allowed kapcsolótól FÜGGETLEN: a hozzáférést mindig vissza lehet vonni.
export async function disconnect(deps: BankDeps, userId: string, body: Record<string, unknown>): Promise<Result> {
  const id = str(body.connection_id);
  if (!id || !UUID.test(id)) return fail('not_found');
  let revoked: { sessionId: string | null };
  try { revoked = await deps.db.revokeConnection(userId, id); }
  catch (e) {
    if (e instanceof DbError && e.code === 'BR404') return fail('not_found');
    log('db_failed', { op: 'revoke' });
    return fail('upstream_failed');
  }
  let deleted = false;
  if (revoked.sessionId) {
    try { await deps.enable.deleteSession(revoked.sessionId); deleted = true; }
    catch (e) { log('session_delete_failed', { status: e instanceof EnableError ? e.status : 0 }); }
  }
  // a helyi visszavonás akkor is megtörtént, ha az Enable-nél a törlés nem sikerült (a hozzáférés a banknál lejáratig él, de nálunk már nem használjuk)
  return ok({ session_deleted: deleted });
}

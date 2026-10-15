// A banki szinkron kezelője (A-48): bank-sync Edge Function. Biztonság az elsődleges (advanced.md §5.4):
//  • a bank felé minden hívás előtt `reserve_bank_sync` (napi ≤ 2 kapcsolatonként, kézi ≥ 12 óra, automatikus ≥ 20 óra);
//  • csak könyvelt (BOOK) tételek; az ablak az utolsó SIKERES szinkron − 3 nap (első alkalommal 90 nap, a PSD2 SCA-ablak);
//  • 401/403/422 → a hozzáférés lejárt/megvonva (`expired`), 429 → nincs újrapróba, egyéb hiba → a következő nap;
//  • a válaszban és a naplóban csak darabszám és státusz van (nincs összeg, név, számlaszám, code/state/session).
import { EnableError, mapTransactions, type EnableApi } from './enable.ts';
import { merchantKey } from './merchant.ts';
import { fail, type Result } from './bank-connect.ts';

export interface ConnRow { id: string; user_id: string; status: string; accounts: unknown; last_success_at: string | null }
export interface IngestSummary { inserted: number; duplicates: number; skipped: number; credits: number; paid: number; linked: number; contributions: number; expenses: number }

export interface SyncDb {
  getConnection(id: string): Promise<ConnRow | null>;
  dueConnections(): Promise<ConnRow[]>;
  reserve(id: string, source: 'manual' | 'auto'): Promise<{ status: string }>;
  ingest(connectionId: string, accountRef: string, rows: unknown[]): Promise<IngestSummary>;
  finish(connectionId: string, ok: boolean, error: string | null, expire: boolean): Promise<void>;
}
export interface SyncDeps { enable: EnableApi; db: SyncDb; now: () => Date }

const log = (event: string, fields: Record<string, unknown> = {}) => console.error(event, JSON.stringify(fields));
const DAY = 86_400_000;
const MAX_PAGES = 10;
const MAX_ROWS = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A `bank_connections.accounts` elemei: kulcs = identification_hash:pénznem (mint a B-oldalon és az ingest-ben); csak a követett számlák */
export function syncAccounts(raw: unknown): Array<{ uid: string; ref: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ uid: string; ref: string }> = [];
  for (const a of raw as Array<Record<string, unknown>>) {
    if (!a || typeof a !== 'object' || a.sync_enabled === false) continue;
    const hash = typeof a.identification_hash === 'string' ? a.identification_hash : null;
    const uid = typeof a.uid === 'string' ? a.uid : null;
    const cur = typeof a.currency === 'string' ? a.currency : null;
    if (hash && uid && cur) out.push({ uid, ref: `${hash}:${cur}` });
  }
  return out;
}

export function syncWindowStart(lastSuccessIso: string | null, now: Date): string {
  const floor = now.getTime() - 90 * DAY;
  const last = lastSuccessIso ? Date.parse(lastSuccessIso) : NaN;
  const from = Number.isFinite(last) ? Math.max(floor, last - 3 * DAY) : floor;   // 3 nap átfedés: a késve könyvelt tételek miatt
  return new Date(from).toISOString().slice(0, 10);
}

export type SyncOutcome = { ok: true; summary: IngestSummary } | { ok: false; reason: 'expired' | 'rate_limited' | 'upstream' | 'error' };

const EMPTY: IngestSummary = { inserted: 0, duplicates: 0, skipped: 0, credits: 0, paid: 0, linked: 0, contributions: 0, expenses: 0 };
const add = (a: IngestSummary, b: IngestSummary): IngestSummary => ({
  inserted: a.inserted + (b.inserted ?? 0), duplicates: a.duplicates + (b.duplicates ?? 0), skipped: a.skipped + (b.skipped ?? 0), credits: a.credits + (b.credits ?? 0),
  paid: a.paid + (b.paid ?? 0), linked: a.linked + (b.linked ?? 0), contributions: a.contributions + (b.contributions ?? 0), expenses: a.expenses + (b.expenses ?? 0),
});

/** Egy kapcsolat szinkronja (a foglalás MÁR megtörtént). Mindig lezárja a futást (`finish_bank_sync`), a hibát sem nyeli el némán. */
export async function syncConnection(deps: SyncDeps, conn: ConnRow): Promise<SyncOutcome> {
  let outcome: SyncOutcome;
  try {
    const dateFrom = syncWindowStart(conn.last_success_at, deps.now());
    let total = { ...EMPTY };
    for (const acct of syncAccounts(conn.accounts)) {
      const rows: unknown[] = [];
      let key: string | null = null;
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await deps.enable.listTransactions(acct.uid, dateFrom, key);
        rows.push(...mapTransactions(res.transactions, merchantKey));
        key = res.continuationKey;
        if (!key) break;
      }
      if (rows.length > MAX_ROWS) { log('sync_rows_capped', { rows: rows.length }); rows.length = MAX_ROWS; }
      // egy hívás számlánként: a refszám nélküli azonos tételek sorszámozása a köteg sorrendjén múlik, ezért nem darabolunk
      if (rows.length) total = add(total, await deps.db.ingest(conn.id, acct.ref, rows));
    }
    outcome = { ok: true, summary: total };
  } catch (e) {
    const status = e instanceof EnableError ? e.status : -1;
    outcome = { ok: false, reason: status === 401 || status === 403 || status === 422 ? 'expired' : status === 429 ? 'rate_limited' : status >= 0 ? 'upstream' : 'error' };
    log('sync_failed', { reason: outcome.reason, status });
  }
  try {
    await deps.db.finish(conn.id, outcome.ok, outcome.ok ? null : outcome.reason, !outcome.ok && outcome.reason === 'expired');
  } catch { log('sync_finish_failed'); }
  return outcome;
}

/** A bank-sync belépési pontja. Törzs: { connection_id?, source: 'manual'|'auto', reserved?: boolean }.
 *  connection_id nélkül (napi cron): minden aktív kapcsolat, kapcsolatonként foglalással. */
export async function runBankSync(deps: SyncDeps, body: Record<string, unknown>): Promise<Result> {
  const source = body.source === 'manual' ? 'manual' : 'auto';
  const id = typeof body.connection_id === 'string' ? body.connection_id : null;
  if (id !== null) {
    if (!UUID.test(id)) return fail('not_found');
    const conn = await deps.db.getConnection(id);
    if (!conn || conn.status !== 'active') return fail('not_found');
    if (body.reserved !== true) {
      const r = await deps.db.reserve(id, source);
      if (r.status !== 'queued') return { status: 200, body: { ok: true, status: r.status } };
    }
    const out = await syncConnection(deps, conn);
    return { status: 200, body: out.ok ? { ok: true, status: 'synced', ...out.summary } : { ok: true, status: 'failed', reason: out.reason } };
  }
  let synced = 0, failed = 0, skipped = 0;
  for (const conn of await deps.db.dueConnections()) {
    let reserved: { status: string };
    try { reserved = await deps.db.reserve(conn.id, 'auto'); } catch { failed++; continue; }
    if (reserved.status !== 'queued') { skipped++; continue; }
    if ((await syncConnection(deps, conn)).ok) synced++; else failed++;
  }
  return { status: 200, body: { ok: true, status: 'done', synced, failed, skipped } };
}

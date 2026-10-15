// A SyncDb megvalósítása service_role-lal (A-48): a logika a security definer SQL-függvényekben él (supabase/tests/bank_sync.test.sql védi).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import type { ConnRow, IngestSummary, SyncDb } from './bank-sync.ts';

const COLS = 'id, user_id, status, accounts, last_success_at';
const check = (error: unknown, op: string) => { if (error) throw new Error(`db ${op} failed`); };   // az üzenet nem kerül tovább (PII-védelem)

export function supabaseSyncDb(admin: SupabaseClient): SyncDb {
  return {
    async getConnection(id) {
      const { data, error } = await admin.from('bank_connections').select(COLS).eq('id', id).maybeSingle();
      check(error, 'get');
      return (data as ConnRow | null) ?? null;
    },
    async dueConnections() {
      const { data, error } = await admin.from('bank_connections').select(COLS).eq('status', 'active').gt('consent_valid_until', new Date().toISOString());
      check(error, 'due');
      return (data ?? []) as ConnRow[];
    },
    async reserve(id, source) {
      const { data, error } = await admin.rpc('reserve_bank_sync', { p_connection: id, p_source: source });
      check(error, 'reserve');
      return { status: typeof data?.status === 'string' ? data.status : 'not_active' };
    },
    async ingest(connectionId, accountRef, rows) {
      const { data, error } = await admin.rpc('ingest_bank_transactions', { p_connection: connectionId, p_account_ref: accountRef, p_rows: rows });
      check(error, 'ingest');
      return data as IngestSummary;
    },
    async finish(connectionId, ok, error, expire) {
      const r = await admin.rpc('finish_bank_sync', { p_connection: connectionId, p_ok: ok, p_error: error, p_expire: expire });
      check(r.error, 'finish');
    },
  };
}

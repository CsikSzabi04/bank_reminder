// A BankDb megvalósítása service_role-lal (A-47): a logika a security definer SQL-függvényekben él (supabase/tests/bank_connect_flow.test.sql védi).
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { DbError, type BankDb } from './bank-connect.ts';

// az SQLSTATE (BR404 / BR429) marad meg, az üzenet nem
const check = (error: { code?: string } | null) => { if (error) throw new DbError(error.code ?? 'unknown'); };

export function supabaseBankDb(admin: SupabaseClient): BankDb {
  return {
    async bankSyncAllowed(userId) {
      const { data, error } = await admin.from('profiles').select('bank_sync_allowed').eq('id', userId).maybeSingle();
      check(error);
      return data?.bank_sync_allowed === true;   // hiányzó profil/null = nem engedett
    },
    async startConnect(userId, state, renew) {
      const { error } = await admin.rpc('start_bank_connect', { p_user: userId, p_state: state, p_renew: renew });
      check(error);
    },
    async consumeState(state, userId) {
      const { data, error } = await admin.rpc('consume_bank_connect_state', { p_state: state, p_user: userId });
      check(error);
      const status = data?.status === 'ok' || data?.status === 'expired' ? data.status : 'invalid';
      return { status, renewConnectionId: typeof data?.renew_connection_id === 'string' ? data.renew_connection_id : null };
    },
    async finishConnection(a) {
      const { data, error } = await admin.rpc('finish_bank_connection', {
        p_user: a.userId, p_renew: a.renewConnectionId, p_aspsp_name: a.aspspName, p_aspsp_country: a.aspspCountry,
        p_session_id: a.sessionId, p_accounts: a.accounts, p_authorized_at: a.authorizedAt, p_valid_until: a.validUntil,
      });
      check(error);
      return { connectionId: String(data.connection_id), oldSessionIds: Array.isArray(data.old_session_ids) ? data.old_session_ids.map(String) : [] };
    },
    async queueFirstSync(connectionId) {
      const { error } = await admin.rpc('queue_bank_sync', { p_connection: connectionId, p_source: 'auto' });
      check(error);
    },
    async revokeConnection(userId, connectionId) {
      const { data, error } = await admin.rpc('revoke_bank_connection', { p_user: userId, p_connection: connectionId });
      check(error);
      return { sessionId: typeof data?.session_id === 'string' ? data.session_id : null };
    },
  };
}

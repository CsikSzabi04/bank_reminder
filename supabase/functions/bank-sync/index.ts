// A-48: bank-sync — napi cron (pg_cron → pg_net, x-cron-secret) VAGY a „Frissítés most" (request_bank_sync → queue_bank_sync, ugyanígy).
// Nincs felhasználói JWT: a hitelesítés a közös cron-titok (konstans idejű), a kapcsolat azonosítóját a DB-függvény adja át.
import { corsHeaders, cronAuthorized, json } from '../_shared/auth.ts';
import { runBankSync } from '../_shared/bank-sync.ts';
import { supabaseSyncDb } from '../_shared/bank-sync-db.ts';
import { enableClient } from '../_shared/bank-runtime.ts';
import { adminClient } from '../_shared/supabase.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  if (!cronAuthorized(req)) return json(403, { error: 'forbidden' });
  let body: Record<string, unknown> = {};
  try { const p = await req.json(); if (p && typeof p === 'object' && !Array.isArray(p)) body = p; } catch { /* üres törzs */ }
  try {
    const r = await runBankSync({ enable: enableClient(), db: supabaseSyncDb(adminClient()), now: () => new Date() }, body);
    return json(r.status, r.body);
  } catch {
    console.error('bank_sync_crashed');
    return json(500, { ok: false, code: 'upstream_failed' });
  }
});

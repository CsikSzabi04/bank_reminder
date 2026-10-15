// Közös HTTP-burok a négy bank-függvényhez (A-47): CORS, POST, JWT-hitelesítés, törzs-méretkorlát, Enable-kliens felépítése.
// A függvények verify_jwt=false-szal futnak (DECISIONS 2026-10-13): a hitelesítés itt, az Auth szerveren át (userFromRequest) történik.
import { corsHeaders, json, userFromRequest } from './auth.ts';
import { supabaseBankDb } from './bank-db.ts';
import { fail, type BankDeps, type Result } from './bank-connect.ts';
import { createEnableClient, EnableError, importPrivateKey, type EnableApi } from './enable.ts';
import { adminClient } from './supabase.ts';

const MAX_BODY = 4096;

let keyPromise: Promise<CryptoKey> | null = null;
function enableClient(): EnableApi {
  const appId = Deno.env.get('ENABLE_APP_ID');
  const secret = Deno.env.get('ENABLE_PRIVATE_KEY');
  if (!appId || !secret) {
    console.error('enable_not_configured');
    const down = (op: string) => () => Promise.reject(new EnableError(0, op));
    return { listAspsps: down('aspsps'), startAuth: down('auth'), createSession: down('sessions'), deleteSession: down('delete_session') };
  }
  keyPromise ??= importPrivateKey(secret);
  // a kulcs-import hibája is csak „upstream_failed" lesz (a kulcs tartalma/formátuma nem kerül a válaszba); hiba után újrapróbálható
  const key = keyPromise.catch((e) => { keyPromise = null; throw e; });
  key.catch(() => {});   // ha a kulcsot egy hívás sem kéri (pl. not_allowed), az elutasítás ne legyen kezeletlen
  return lazyClient(appId, key);
}

// a kulcs aszinkron importja miatt a kliens az első híváskor áll össze
function lazyClient(appId: string, key: Promise<CryptoKey>): EnableApi {
  let real: EnableApi | null = null;
  const get = async () => (real ??= createEnableClient({ appId, key: await key }));
  return {
    listAspsps: async (c) => (await get()).listAspsps(c),
    startAuth: async (a) => (await get()).startAuth(a),
    createSession: async (c) => (await get()).createSession(c),
    deleteSession: async (s) => (await get()).deleteSession(s),
  };
}

export async function serveBank(req: Request, handler: (deps: BankDeps, userId: string, body: Record<string, unknown>) => Promise<Result>): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, code: 'unknown' });
  const admin = adminClient();
  const user = await userFromRequest(req, admin);
  if (!user) { const r = fail('unauthenticated'); return json(r.status, r.body); }

  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { ok: false, code: 'unknown' });
  let body: Record<string, unknown> = {};
  try { const parsed = text ? JSON.parse(text) : {}; if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) body = parsed; } catch { /* üres törzs */ }

  const deps: BankDeps = {
    enable: enableClient(), db: supabaseBankDb(admin), appBaseUrl: Deno.env.get('APP_BASE_URL') ?? null,
    now: () => new Date(), randomState: () => crypto.randomUUID(),
  };
  try {
    const r = await handler(deps, user.id, body);
    return json(r.status, r.body);
  } catch {
    console.error('bank_function_crashed');   // a hiba tartalma nem kerül naplóba (PII/titok-védelem)
    return json(500, { ok: false, code: 'upstream_failed' });
  }
}

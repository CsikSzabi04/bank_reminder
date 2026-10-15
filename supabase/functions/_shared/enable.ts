// Enable Banking API kliens (A-47). Az A-40 spike döntései: RS256 JWT a WebCrypto-val (nincs külső könyvtár), PKCS#8 kulcs,
// `kid` = App ID, `iss: enablebanking.com`, `aud: api.enablebanking.com`. A privát kulcs csak az Edge secretben él (ENABLE_PRIVATE_KEY),
// soha nem kerül naplóba/válaszba. A hibákból csak a HTTP-státusz marad meg (a válasz-törzs nem), hogy PII/titok ne szivároghasson.

const API = 'https://api.enablebanking.com';

const b64u = (bytes: Uint8Array | string): string => {
  const raw = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  let s = '';
  for (const b of raw) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

/** A kulcs lehet PEM (valódi vagy `\n`-nel escape-elt sortörésekkel) vagy a PKCS#8 törzs egysoros base64-e (a `db:secrets` így tölti fel). */
export async function importPrivateKey(secret: string): Promise<CryptoKey> {
  const text = secret.trim().replace(/\\n/g, '\n');
  const kind = /-----BEGIN ([A-Z ]+)-----/.exec(text)?.[1];
  if (kind && kind !== 'PRIVATE KEY') throw new Error(`a kulcs formátuma „${kind}", PKCS#8 („PRIVATE KEY") kell`);
  const body = text.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  let der: Uint8Array<ArrayBuffer>;
  try { der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0)); } catch { throw new Error('a kulcs nem érvényes base64'); }
  return await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

export async function makeJwt(appId: string, key: CryptoKey, nowSec: number, ttlSec = 3600): Promise<string> {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'RS256', kid: appId }));
  const body = b64u(JSON.stringify({ iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: nowSec, exp: nowSec + ttlSec }));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(new Uint8Array(sig))}`;
}

/** Az Enable hibája: csak a státusz (a törzs szándékosan nem része az üzenetnek) */
export class EnableError extends Error {
  constructor(public status: number, public op: string) { super(`enable ${op} failed: ${status}`); }
}

export interface Aspsp { name: string; country: string; maxConsentDays: number | null; personal: boolean }
export interface EnableAccount {
  uid?: string; identification_hash?: string; identification_hashes?: string[]; currency?: string;
  cash_account_type?: string; name?: string; account_id?: { iban?: string }; [k: string]: unknown;
}
export interface EnableSession {
  session_id: string; aspsp?: { name?: string; country?: string }; accounts?: EnableAccount[];
  access?: { valid_until?: string };
}

export interface EnableApi {
  listAspsps(country: string): Promise<Aspsp[]>;
  startAuth(a: { aspspName: string; aspspCountry: string; state: string; redirectUrl: string; validUntil: string }): Promise<{ url: string }>;
  createSession(code: string): Promise<EnableSession>;
  deleteSession(sessionId: string): Promise<void>;
}

export interface EnableOptions {
  appId: string;
  key: CryptoKey;
  fetchFn?: typeof fetch;
  nowMs?: () => number;
  baseUrl?: string;
}

export function createEnableClient(o: EnableOptions): EnableApi {
  const doFetch = o.fetchFn ?? fetch;
  const now = o.nowMs ?? Date.now;
  const base = o.baseUrl ?? API;
  let cached: { jwt: string; exp: number } | null = null;

  async function token(): Promise<string> {
    const sec = Math.floor(now() / 1000);
    if (cached && cached.exp - 120 > sec) return cached.jwt;
    const jwt = await makeJwt(o.appId, o.key, sec, 3600);
    cached = { jwt, exp: sec + 3600 };
    return jwt;
  }

  async function call(op: string, method: string, path: string, body?: unknown): Promise<unknown> {
    let res: Response;
    try {
      res = await doFetch(`${base}${path}`, {
        method,
        headers: { Authorization: `Bearer ${await token()}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch { throw new EnableError(0, op); }   // hálózati hiba/időtúllépés
    if (!res.ok) { await res.body?.cancel(); throw new EnableError(res.status, op); }
    return await res.json().catch(() => ({}));
  }

  return {
    async listAspsps(country) {
      const r = await call('aspsps', 'GET', `/aspsps?country=${encodeURIComponent(country)}`) as { aspsps?: Array<Record<string, unknown>> };
      return (r.aspsps ?? []).flatMap((a): Aspsp[] => {
        if (typeof a.name !== 'string' || typeof a.country !== 'string') return [];
        const secs = typeof a.maximum_consent_validity === 'number' ? a.maximum_consent_validity : null;
        const types = Array.isArray(a.psu_types) ? a.psu_types : [];
        return [{ name: a.name, country: a.country, maxConsentDays: secs && secs > 0 ? Math.floor(secs / 86400) : null, personal: types.includes('personal') }];
      });
    },
    async startAuth(a) {
      const r = await call('auth', 'POST', '/auth', {
        access: { valid_until: a.validUntil }, aspsp: { name: a.aspspName, country: a.aspspCountry },
        state: a.state, redirect_url: a.redirectUrl, psu_type: 'personal',
      }) as { url?: unknown };
      if (typeof r.url !== 'string') throw new EnableError(502, 'auth');
      return { url: r.url };
    },
    async createSession(code) {
      const r = await call('sessions', 'POST', '/sessions', { code }) as EnableSession;
      if (typeof r.session_id !== 'string' || !r.session_id) throw new EnableError(502, 'sessions');
      return r;
    },
    async deleteSession(sessionId) { await call('delete_session', 'DELETE', `/sessions/${encodeURIComponent(sessionId)}`); },
  };
}

/** A számla-lista a `bank_connections.accounts`-ba (advanced.md §4, A-40 leletek): teljes IBAN SOHA — csak az utolsó 4 jegy; kulcs: identification_hash + pénznem. */
export function mapAccounts(raw: EnableAccount[] | undefined): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [];
  for (const a of raw ?? []) {
    const hash = typeof a.identification_hash === 'string' && a.identification_hash ? a.identification_hash
      : Array.isArray(a.identification_hashes) && typeof a.identification_hashes[0] === 'string' ? a.identification_hashes[0] : null;
    const uid = typeof a.uid === 'string' && a.uid ? a.uid : null;
    const currency = typeof a.currency === 'string' && /^[A-Za-z]{3}$/.test(a.currency.trim()) ? a.currency.trim().toUpperCase() : null;
    if (!(hash ?? uid) || !currency) continue;
    const iban = typeof a.account_id?.iban === 'string' ? a.account_id.iban.replace(/\s+/g, '') : '';
    const type = typeof a.cash_account_type === 'string' ? a.cash_account_type.toUpperCase().slice(0, 8) : 'OTHR';
    const name = typeof a.name === 'string' && a.name.trim() ? a.name.trim().slice(0, 60) : null;
    out.push({
      uid, identification_hash: hash ?? uid, currency, cash_account_type: type,
      iban_last4: /^[A-Za-z0-9]{4,}$/.test(iban) ? iban.slice(-4) : null,
      name,
      // alapból a folyószámlák szinkronizálnak, a megtakarítás/egyéb külön bekapcsolandó (A-40 ADR)
      sync_enabled: type === 'CACC',
    });
  }
  return out;
}

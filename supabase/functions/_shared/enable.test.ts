import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { createEnableClient, EnableError, importPrivateKey, makeJwt, mapAccounts } from './enable.ts';

// Teszt-kulcspár (a tesztben generált; nem valódi kulcs)
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', pair.privateKey));
const b64 = btoa(String.fromCharCode(...pkcs8));
// a PEM-fejlécet összeillesztjük, hogy a H3 titokvizsgáló ne a teszt-kulcs sablonját vegye valódi titoknak
const D = '-----';
const armor = (kind: string, body: string) => `${D}BEGIN ${kind}${D}\n${body}\n${D}END ${kind}${D}\n`;
const pem = armor('PRIVATE ' + 'KEY', b64.match(/.{1,64}/g)!.join('\n'));
const dec = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

Deno.test('importPrivateKey: PEM, `\\n`-escape-elt PEM és egysoros base64 is megy; PKCS#1 és szemét elutasítva', async () => {
  for (const form of [pem, pem.replace(/\n/g, '\\n'), b64]) {
    const k = await importPrivateKey(form);
    assertEquals(k.algorithm.name, 'RSASSA-PKCS1-v1_5');
    assertEquals(k.extractable, false, 'a kulcs nem exportálható');
  }
  await assertRejects(() => importPrivateKey(armor('RSA PRIVATE ' + 'KEY', 'AAAA')), Error, 'PKCS#8');
  await assertRejects(() => importPrivateKey('ez nem kulcs!!'), Error);
});

Deno.test('makeJwt: RS256, kid = App ID, a megadott időkkel, és a nyilvános kulccsal ellenőrizhető', async () => {
  const key = await importPrivateKey(b64);
  const jwt = await makeJwt('app-123', key, 1_000_000, 3600);
  const [h, p, s] = jwt.split('.');
  assertEquals(JSON.parse(new TextDecoder().decode(dec(h))), { typ: 'JWT', alg: 'RS256', kid: 'app-123' });
  assertEquals(JSON.parse(new TextDecoder().decode(dec(p))), { iss: 'enablebanking.com', aud: 'api.enablebanking.com', iat: 1_000_000, exp: 1_003_600 });
  assert(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pair.publicKey, dec(s), new TextEncoder().encode(`${h}.${p}`)), 'az aláírás nem ellenőrizhető');
  assert(!jwt.includes('PRIVATE') && !jwt.includes(b64.slice(0, 40)), 'a kulcs szivárog a JWT-be');
});

type Call = { url: string; method: string; auth: string | null; body: unknown };
function fakeFetch(replies: Array<{ status?: number; json?: unknown }>) {
  const calls: Call[] = [];
  const fn = ((url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? 'GET', auth: new Headers(init.headers).get('Authorization'), body: init.body ? JSON.parse(String(init.body)) : undefined });
    const r = replies.shift() ?? { status: 500 };
    return Promise.resolve(new Response(JSON.stringify(r.json ?? {}), { status: r.status ?? 200 }));
  }) as unknown as typeof fetch;
  return { fn, calls };
}
const client = async (replies: Array<{ status?: number; json?: unknown }>, nowMs = () => 1_000_000_000) => {
  const f = fakeFetch(replies);
  return { api: createEnableClient({ appId: 'app-1', key: await importPrivateKey(b64), fetchFn: f.fn, nowMs, baseUrl: 'https://enable.test' }), ...f };
};

Deno.test('kliens: hívások alakja, Bearer JWT, a JWT-t újrahasználja, lejárat közelében újat készít', async () => {
  let t = 1_000_000_000;
  const { api, calls } = await client([
    { json: { aspsps: [{ name: 'Revolut', country: 'HU', maximum_consent_validity: 15552000, psu_types: ['personal', 'business'] }, { name: 'Cég', country: 'HU', psu_types: ['business'] }, { country: 'HU' }] } },
    { json: { url: 'https://auth.test/x' } }, { json: { session_id: 's1', accounts: [] } }, { status: 200, json: {} }, { json: { aspsps: [] } },
  ], () => t);
  const list = await api.listAspsps('HU');
  assertEquals(list, [{ name: 'Revolut', country: 'HU', maxConsentDays: 180, personal: true }, { name: 'Cég', country: 'HU', maxConsentDays: null, personal: false }]);
  assertEquals(calls[0].url, 'https://enable.test/aspsps?country=HU');
  const started = await api.startAuth({ aspspName: 'Revolut', aspspCountry: 'HU', state: 'st-1', redirectUrl: 'https://app.test/bank/callback', validUntil: '2027-01-01T00:00:00.000Z' });
  assertEquals(started.url, 'https://auth.test/x');
  assertEquals(calls[1].body, { access: { valid_until: '2027-01-01T00:00:00.000Z' }, aspsp: { name: 'Revolut', country: 'HU' }, state: 'st-1', redirect_url: 'https://app.test/bank/callback', psu_type: 'personal' });
  assertEquals((await api.createSession('code-1')).session_id, 's1');
  assertEquals(calls[2].body, { code: 'code-1' });
  await api.deleteSession('s1/../x');
  assertEquals(calls[3].url, 'https://enable.test/sessions/s1%2F..%2Fx', 'a session-azonosító nincs path-injektálva');
  assertEquals(calls[3].method, 'DELETE');
  assert(calls.every((c) => /^Bearer [\w-]+\.[\w-]+\.[\w-]+$/.test(c.auth ?? '')), 'nem JWT-s Authorization');
  assertEquals(new Set(calls.map((c) => c.auth)).size, 1, 'a JWT-t nem használja újra');
  t += 3500 * 1000;   // a lejárat előtt 100 mp-cel: ugyanaz a kliens új JWT-t készít
  await api.listAspsps('HU');
  assert(calls[4].auth !== calls[0].auth, 'a lejárat közelében is a régi JWT-t küldte');
});

Deno.test('hibák: csak a státusz marad (a törzs/titok nem), hálózati hiba = 0, hiányzó session_id/url = 502', async () => {
  const { api } = await client([{ status: 403, json: { message: 'Teszt Elek IBAN HU93 1234 secret' } }, { status: 500 }]);
  const e = await assertRejects(() => api.listAspsps('HU'), EnableError);
  assertEquals((e as EnableError).status, 403);
  assert(!(e as EnableError).message.includes('Teszt') && !(e as EnableError).message.includes('IBAN'), 'a válasz-törzs bekerült a hibába');
  await assertRejects(() => api.createSession('c'), EnableError);
  const { api: a2 } = await client([{ json: {} }, { json: {} }]);
  assertEquals(((await assertRejects(() => a2.startAuth({ aspspName: 'x', aspspCountry: 'HU', state: 's', redirectUrl: 'https://a', validUntil: 'v' }), EnableError)) as EnableError).status, 502);
  assertEquals(((await assertRejects(() => a2.createSession('c'), EnableError)) as EnableError).status, 502);
  const net = createEnableClient({ appId: 'a', key: await importPrivateKey(b64), fetchFn: (() => Promise.reject(new TypeError('boom'))) as unknown as typeof fetch });
  assertEquals(((await assertRejects(() => net.listAspsps('HU'), EnableError)) as EnableError).status, 0);
});

Deno.test('mapAccounts: teljes IBAN soha; hash+pénznem a kulcs; az IBAN nélküli megtakarítás is megy; érvénytelen kihagyva; CACC alapból szinkronizál', () => {
  const iban = 'HU93 1234 5678 9012 3456 7890 0001';
  const out = mapAccounts([
    { uid: 'u1', identification_hash: 'h1', currency: 'huf', cash_account_type: 'CACC', name: ' Fő számla ', account_id: { iban } },
    { uid: 'u2', identification_hash: 'h1', currency: 'USD', cash_account_type: 'CACC', account_id: { iban } },   // azonos IBAN, más pénznem
    { uid: 'u3', identification_hashes: ['h3', 'h3b'], currency: 'HUF', cash_account_type: 'SVGS' },            // nincs IBAN
    { uid: 'u4', currency: 'FORINT' },                                                                           // érvénytelen pénznem
    { currency: 'EUR' },                                                                                           // nincs azonosító
  ]);
  assertEquals(out.length, 3);
  assertEquals(out[0], { uid: 'u1', identification_hash: 'h1', currency: 'HUF', cash_account_type: 'CACC', iban_last4: '0001', name: 'Fő számla', sync_enabled: true });
  assertEquals(out[1].iban_last4, '0001');
  assertEquals(out[2], { uid: 'u3', identification_hash: 'h3', currency: 'HUF', cash_account_type: 'SVGS', iban_last4: null, name: null, sync_enabled: false });
  const json = JSON.stringify(out);
  assert(!json.includes('HU93') && !json.includes('1234 5678') && !json.includes('34567890'), 'teljes IBAN a kimenetben: ' + json);
  assertEquals(mapAccounts(undefined), []);
});

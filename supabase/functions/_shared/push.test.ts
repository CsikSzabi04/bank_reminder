// A-20 spike + teszt: az npm:web-push Deno alatt RFC 8291 (aes128gcm) szerint titkosít és RFC 8292 szerint VAPID-del aláír.
// Független visszafejtés WebCrypto-val — nem a könyvtár saját kódjára támaszkodik. Futtatás: deno test -A supabase/functions/_shared/
import { assert, assertEquals } from 'jsr:@std/assert@1';
import webpush from 'npm:web-push@3.6.7';
import { isAllowedPushEndpoint } from './push.ts';

const pad = (s: string) => s + '='.repeat((4 - (s.length % 4)) % 4);
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(pad(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const concat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
const enc = new TextEncoder();

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, k, len * 8));
}

Deno.test('web-push: a törzs RFC 8291 szerint visszafejthető, a VAPID-JWT érvényes', async () => {
  const ua = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const uaPub = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
  const authSecret = crypto.getRandomValues(new Uint8Array(16));
  const vapid = webpush.generateVAPIDKeys();
  webpush.setVapidDetails('mailto:test@example.test', vapid.publicKey, vapid.privateKey);

  const payload = JSON.stringify({ title: 'Netflix — holnap esedékes', body: '2 300 Ft · nov. 10.', note: 'őűáéíóöüú'.repeat(20) });
  const d = await webpush.generateRequestDetails(
    { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: b64u(uaPub), auth: b64u(authSecret) } },
    payload, { TTL: 86400, urgency: 'normal', topic: 'rem-abc' },
  );

  // fejlécek
  assertEquals(d.method, 'POST');
  assertEquals(d.headers['Content-Encoding'], 'aes128gcm');
  assertEquals(String(d.headers['TTL']), '86400');
  assertEquals(d.headers['Urgency'], 'normal');
  assertEquals(d.headers['Topic'], 'rem-abc');

  // RFC 8291 visszafejtés (a fejléc: salt16 | rs4 | idlen1 | keyid | ciphertext)
  const body = new Uint8Array(d.body as Uint8Array);
  const salt = body.slice(0, 16);
  const idlen = body[20];
  assertEquals(idlen, 65);
  const asPub = body.slice(21, 21 + idlen);
  const ct = body.slice(21 + idlen);
  const asKey = await crypto.subtle.importKey('raw', asPub, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
  const ikm = await hkdf(ecdh, authSecret, concat(enc.encode('WebPush: info\0'), uaPub, asPub), 32);
  const cek = await hkdf(ikm, salt, enc.encode('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(ikm, salt, enc.encode('Content-Encoding: nonce\0'), 12);
  const aes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']);
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, aes, ct));
  let end = plain.length;
  while (end > 0 && plain[end - 1] === 0) end--;
  assertEquals(plain[end - 1], 2, 'az utolsó rekord határolója (0x02) hiányzik');
  assertEquals(new TextDecoder().decode(plain.slice(0, end - 1)), payload);

  // VAPID (RFC 8292): "vapid t=<jwt>, k=<pub>"
  const m = /^vapid t=([^,]+), k=(.+)$/.exec(String(d.headers['Authorization']));
  assert(m, 'az Authorization fejléc nem vapid t=…, k=… alakú: ' + d.headers['Authorization']);
  assertEquals(m[2], vapid.publicKey);
  const [h, p, s] = m[1].split('.');
  assertEquals(JSON.parse(new TextDecoder().decode(unb64u(h))).alg, 'ES256');
  const claims = JSON.parse(new TextDecoder().decode(unb64u(p)));
  assertEquals(claims.aud, 'https://fcm.googleapis.com');
  assertEquals(claims.sub, 'mailto:test@example.test');
  const now = Math.floor(Date.now() / 1000);
  assert(claims.exp > now && claims.exp <= now + 86400, 'a VAPID exp nem 24 órán belüli');
  const vk = await crypto.subtle.importKey('raw', unb64u(vapid.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
  assert(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, vk, unb64u(s), enc.encode(`${h}.${p}`)), 'a VAPID-JWT aláírása érvénytelen');
});

Deno.test('push-endpoint engedélyezőlista (SSRF-védelem)', () => {
  for (const ok of [
    'https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/abc', 'https://wns2-par02p.notify.windows.com/?token=x',
  ]) assert(isAllowedPushEndpoint(ok), ok);
  for (const bad of [
    'http://fcm.googleapis.com/x', 'https://evil.example.com/x', 'https://fcm.googleapis.com.evil.com/x', 'https://evilfcm.googleapis.com.attacker.io/',
    'https://fcm.googleapis.com:8443/x', 'https://user:pw@fcm.googleapis.com/x', 'https://127.0.0.1/x', 'https://localhost/', 'javascript:alert(1)', '', 'nem-url',
  ]) assert(!isAllowedPushEndpoint(bad), bad);
});

// Web Push küldés (VAPID, RFC 8030/8291/8292). Könyvtár: npm:web-push (A-20 spike döntése: DECISIONS.md).
// SSRF-védelem: csak engedélyezőlistás push-szolgáltatók (az adatbázisban is van CHECK, ez a második védvonal).
import webpush from 'npm:web-push@3.6.7';

const HOST_RE = /^(?:[a-z0-9-]+\.)*(?:fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;

export function isAllowedPushEndpoint(endpoint: string): boolean {
  try {
    const u = new URL(endpoint);
    return u.protocol === 'https:' && (u.port === '' || u.port === '443') && HOST_RE.test(u.hostname) && !u.username && !u.password;
  } catch {
    return false;
  }
}

export interface PushSubscriptionRow { endpoint: string; p256dh: string; auth: string }
export interface PushResult { status: number; error?: string }

let configured = false;
function configure() {
  if (configured) return;
  const subject = Deno.env.get('VAPID_SUBJECT');
  const pub = Deno.env.get('VAPID_PUBLIC_KEY');
  const priv = Deno.env.get('VAPID_PRIVATE_KEY');
  if (!subject || !pub || !priv) throw new Error('VAPID_SUBJECT / VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY nincs beállítva (supabase secrets set)');
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

/** Egy eszközre küld. A státusz: 2xx siker · 404/410 halott endpoint · 429/5xx átmeneti · 0 = hálózati hiba/időtúllépés. */
export async function sendPush(sub: PushSubscriptionRow, payload: Record<string, unknown>, opts: { ttl?: number; topic?: string } = {}): Promise<PushResult> {
  if (!isAllowedPushEndpoint(sub.endpoint)) return { status: 400, error: 'endpoint_not_allowed' };
  configure();
  try {
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: opts.ttl ?? 86_400, urgency: 'normal', topic: opts.topic?.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 32) || undefined, timeout: 10_000 },
    );
    return { status: res.statusCode };
  } catch (e) {
    const err = e as { statusCode?: number; body?: string; message?: string };
    return { status: typeof err.statusCode === 'number' ? err.statusCode : 0, error: String(err.body ?? err.message ?? e).slice(0, 200) };
  }
}

export { webpush };

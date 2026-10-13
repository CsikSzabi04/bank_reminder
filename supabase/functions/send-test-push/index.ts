// A-17: teszt-értesítés a felhasználó MINDEN aktív eszközére — a valódi útvonalat járja be (szerver → push szolgáltató → SW).
// Hívó: B (supabase.functions.invoke), felhasználói JWT-vel. Korlát: 3 teszt / perc / felhasználó.
import { corsHeaders, json, userFromRequest, ymdIn } from '../_shared/auth.ts';
import { adminClient } from '../_shared/supabase.ts';
import { renderNotification, toPushPayload, type Locale } from '../_shared/i18n.ts';
import { sendPush } from '../_shared/push.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  const admin = adminClient();
  const user = await userFromRequest(req, admin);
  if (!user) return json(401, { ok: false, error: 'unauthenticated' });

  const since = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin.from('notifications').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('kind', 'system').like('dedupe_key', 'test:%').gte('created_at', since);
  if ((count ?? 0) >= 3) return json(429, { ok: false, error: 'rate_limited' });

  const [{ data: prof }, { data: subs }] = await Promise.all([
    admin.from('profiles').select('locale, timezone').eq('id', user.id).maybeSingle(),
    admin.from('push_subscriptions').select('id, endpoint, p256dh, auth, platform, label').eq('user_id', user.id).is('disabled_at', null),
  ]);
  const locale = ((prof?.locale as Locale) ?? 'hu');
  const tz = prof?.timezone ?? 'Europe/Budapest';
  if (!subs?.length) return json(200, { ok: false, sent: 0, devices: 0, errors: ['no_active_subscription'] });

  // a próba számolása (rate limit) + napló; channel='push' → a bejövő-listában nem jelenik meg
  const now = Date.now();
  await admin.from('notifications').insert({
    user_id: user.id, kind: 'system', channel: 'push', payload: { test: true }, scheduled_for: new Date(now).toISOString(),
    status: 'sent', sent_at: new Date(now).toISOString(), dedupe_key: `test:${user.id}:${now}`,
  });

  let sent = 0;
  const errors: string[] = [];
  await Promise.all(subs.map(async (s) => {
    const device = s.label ?? s.platform ?? 'device';
    const r = renderNotification(
      { id: crypto.randomUUID(), kind: 'system', reminder_id: null, occurrence_id: null, payload: {}, dedupe_key: 't', scheduled_for: new Date(now).toISOString() },
      { locale, today: ymdIn(tz), hideDetails: false, device },
    );
    const res = await sendPush(s, toPushPayload(r), { ttl: 300, topic: 'test' });
    await admin.rpc('record_push_result', { p_sub: s.id, p_http: res.status });
    if (res.status >= 200 && res.status < 300) sent++; else errors.push(`${s.platform ?? 'device'}:${res.status}`);
  }));
  return json(200, { ok: sent > 0, sent, devices: subs.length, ...(errors.length ? { errors } : {}) });
});

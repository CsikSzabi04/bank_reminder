// A-16: esedékes értesítések kiküldése (pg_cron → pg_net percenként). ARCHITECTURE.md §12.2, §12.11.
// Folyamat: claim (FOR UPDATE SKIP LOCKED, kapcsolók + elavulás a DB-ben) → szöveg a felhasználó nyelvén → push/e-mail → finish.
import { addDays, cronAuthorized, json, pool, ymdIn } from '../_shared/auth.ts';
import { adminClient } from '../_shared/supabase.ts';
import { renderEmail, renderNotification, toPushPayload, type Locale, type NotificationRow } from '../_shared/i18n.ts';
import { sendPush } from '../_shared/push.ts';
import { sendEmail } from '../_shared/email.ts';

type Row = NotificationRow & { user_id: string; channel: 'push' | 'email'; attempts: number };
interface Profile { locale: Locale; timezone: string; notify_hide_details: boolean }

Deno.serve(async (req) => {
  if (!cronAuthorized(req)) return json(403, { error: 'forbidden' });
  const admin = adminClient();

  const { data, error } = await admin.rpc('claim_due_notifications', { p_limit: 100 });
  if (error) { console.error('claim_failed', error.code); return json(500, { error: 'claim_failed' }); }
  const rows = (data ?? []) as Row[];
  const stats = { claimed: rows.length, sent: 0, retry: 0, cancelled: 0 };
  const profiles = new Map<string, Profile | null>();

  const finish = async (id: string, outcome: 'sent' | 'retry' | 'cancelled', err?: string) => {
    await admin.rpc('finish_notification', { p_id: id, p_outcome: outcome, p_error: err ?? null });
    stats[outcome === 'sent' ? 'sent' : outcome === 'retry' ? 'retry' : 'cancelled']++;
  };
  const profileOf = async (uid: string): Promise<Profile | null> => {
    if (!profiles.has(uid)) {
      const { data: p } = await admin.from('profiles').select('locale, timezone, notify_hide_details').eq('id', uid).maybeSingle();
      profiles.set(uid, (p as Profile | null) ?? null);
    }
    return profiles.get(uid)!;
  };

  await pool(rows, 8, async (row) => {
    try {
      const prof = await profileOf(row.user_id);
      if (!prof) return await finish(row.id, 'cancelled', 'no_profile');
      const today = ymdIn(prof.timezone);

      if (row.channel === 'push') {
        const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth')
          .eq('user_id', row.user_id).is('disabled_at', null);
        if (!subs?.length) return await finish(row.id, 'cancelled', 'no_active_subscription');

        // app-jelvény: lejárt + 3 napon belül esedékes tételek
        const { count } = await admin.from('occurrences').select('id', { count: 'exact', head: true })
          .eq('user_id', row.user_id).eq('status', 'upcoming').lte('due_date', addDays(today, 3));
        const r = renderNotification(row, { locale: prof.locale, today, hideDetails: prof.notify_hide_details, badge: count ?? undefined });

        const results = await Promise.all(subs.map(async (s) => {
          const res = await sendPush(s, toPushPayload(r), { topic: r.tag });
          await admin.rpc('record_push_result', { p_sub: s.id, p_http: res.status });
          return res.status;
        }));
        if (results.some((st) => st >= 200 && st < 300)) return await finish(row.id, 'sent');
        if (results.every((st) => st === 404 || st === 410 || st === 400)) return await finish(row.id, 'cancelled', 'all_endpoints_gone');
        return await finish(row.id, 'retry', `push_status:${results.join(',')}`);
      }

      if (row.channel === 'email') {
        const { data: u } = await admin.auth.admin.getUserById(row.user_id);
        const to = u?.user?.email;
        if (!to) return await finish(row.id, 'cancelled', 'no_email');
        const r = renderNotification(row, { locale: prof.locale, today, hideDetails: prof.notify_hide_details });
        const res = await sendEmail(to, renderEmail(r, Deno.env.get('APP_BASE_URL') ?? 'http://localhost:3000'));
        if (res.ok) return await finish(row.id, 'sent');
        if (res.reason === 'no_provider') return await finish(row.id, 'cancelled', 'no_email_provider');
        if ((res.status ?? 0) === 0 || res.status === 429 || (res.status ?? 0) >= 500) return await finish(row.id, 'retry', res.reason);
        return await finish(row.id, 'cancelled', res.reason);
      }
    } catch (e) {
      console.error('process_failed', row.id, (e as Error).name);          // PII nélkül
      await finish(row.id, 'retry', 'exception');
    }
  });

  return json(200, stats);
});

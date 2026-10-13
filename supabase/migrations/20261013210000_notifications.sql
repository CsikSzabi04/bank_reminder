-- A-12 + A-13: értesítési sor-építő, claim/finish, push/ICS/export RPC-k (ARCHITECTURE.md §12, §21.2).
-- In_app sorok: status='sent' (a láthatóságot a scheduled_for <= now() adja); push/email sorok: pending → sending → sent/failed.

-- ───────── in_app látható csak a nem törölt sor ─────────
drop policy if exists notif_select on public.notifications;
create policy notif_select on public.notifications for select to authenticated
  using ((select auth.uid()) = user_id and channel = 'in_app' and status <> 'cancelled' and scheduled_for <= now());
drop policy if exists notif_update on public.notifications;
create policy notif_update on public.notifications for update to authenticated
  using ((select auth.uid()) = user_id and channel = 'in_app' and status <> 'cancelled' and scheduled_for <= now())
  with check ((select auth.uid()) = user_id and channel = 'in_app' and status <> 'cancelled' and scheduled_for <= now());

-- ───────── segéd: egy esedékesség függő értesítéseinek törlése/eltüntetése ─────────
create or replace function public.cancel_occurrence_notifications(p_occ uuid, p_now timestamptz default now())
returns void language sql security definer set search_path = '' as $$
  update public.notifications set status = 'cancelled'
   where occurrence_id = p_occ and kind in ('reminder', 'overdue')
     and (status in ('pending', 'failed') or (channel = 'in_app' and status = 'sent' and scheduled_for > p_now))
$$;

-- ───────── sor-építő: egy emlékeztető (esedékesség × offset × csatorna) ─────────
create or replace function public.rebuild_notification_queue(p_reminder_id uuid, p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare r public.reminders; p public.profiles; chans text[]; n int := 0; today date;
begin
  select * into r from public.reminders where id = p_reminder_id;
  if not found then return 0; end if;
  select * into p from public.profiles where id = r.user_id;

  -- a még nem elküldött / még nem látható sorok újraépítése (a küldött és a látható előzmény marad)
  delete from public.notifications
   where reminder_id = r.id and kind = 'reminder' and dedupe_key like 'rem:%'
     and (status in ('pending', 'cancelled') or (channel = 'in_app' and scheduled_for > p_now));

  if not r.is_active or not r.remind_enabled or not p.reminders_enabled then return 0; end if;

  chans := array['in_app']
    || case when p.channel_push  and 'push'  = any(r.channels) then array['push']  else array[]::text[] end
    || case when p.channel_email and 'email' = any(r.channels) then array['email'] else array[]::text[] end;
  today := (p_now at time zone p.timezone)::date;

  insert into public.notifications (user_id, kind, channel, reminder_id, occurrence_id, payload, scheduled_for, status, sent_at, dedupe_key)
  select r.user_id, 'reminder', ch, r.id, o.id,
         jsonb_build_object('name', r.name, 'amount', o.amount, 'currency', o.currency, 'due_date', o.due_date, 'offset', offs, 'occ', o.id),
         s.sched,
         case when ch = 'in_app' then 'sent' else 'pending' end,
         case when ch = 'in_app' then s.sched end,
         'rem:' || o.id || ':' || offs || ':' || ch
    from public.occurrences o
    cross join unnest(r.remind_offsets) as offs
    cross join unnest(chans) as ch
    cross join lateral (select ((o.due_date - offs::int) + r.remind_time) at time zone p.timezone as sched) s
   where o.reminder_id = r.id and o.status = 'upcoming' and o.due_date >= today - 1
     and s.sched >= p_now - interval '24 hours'          -- elavult értesítést nem építünk
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.rebuild_notification_queue_all(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare rid uuid; n int := 0;
begin
  for rid in select id from public.reminders loop n := n + public.rebuild_notification_queue(rid, p_now); end loop;
  return n;
end $$;

-- ───────── extra sorok: lejárt, próbaidő, heti összefoglaló (percenként/5 percenként futtatva) ─────────
create or replace function public.enqueue_extra_notifications(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare n int := 0; c int; u public.profiles; v_loc timestamp; v_sched timestamptz; cnt int; tot numeric; items jsonb; chans text[]; v_ch text;
begin
  -- lejárt tétel: a lejárat utáni 1. és 4. napon
  insert into public.notifications (user_id, kind, channel, reminder_id, occurrence_id, payload, scheduled_for, status, sent_at, dedupe_key)
  select o.user_id, 'overdue', ch, o.reminder_id, o.id,
         jsonb_build_object('name', r.name, 'amount', o.amount, 'currency', o.currency, 'due_date', o.due_date, 'k', kk.k, 'occ', o.id),
         s.sched, case when ch = 'in_app' then 'sent' else 'pending' end, case when ch = 'in_app' then s.sched end,
         'ovd:' || o.id || ':' || kk.k || ':' || ch
    from public.occurrences o
    join public.reminders r on r.id = o.reminder_id and r.is_active and r.remind_enabled
    join public.profiles  p on p.id = o.user_id and p.reminders_enabled
    cross join (values (1, 1), (2, 4)) as kk(k, days)
    cross join lateral (select ((o.due_date + kk.days) + r.remind_time) at time zone p.timezone as sched) s
    cross join lateral unnest(array['in_app']
         || case when p.channel_push  and 'push'  = any(r.channels) then array['push']  else array[]::text[] end
         || case when p.channel_email and 'email' = any(r.channels) then array['email'] else array[]::text[] end) as ch
   where o.status = 'upcoming' and s.sched between p_now - interval '24 hours' and p_now + interval '1 hour'
  on conflict (dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- ingyenes próba vége: a lejárat előtti napon
  insert into public.notifications (user_id, kind, channel, reminder_id, payload, scheduled_for, status, sent_at, dedupe_key)
  select r.user_id, 'trial_end', ch, r.id,
         jsonb_build_object('name', r.name, 'amount', r.amount, 'currency', r.currency, 'trial_ends_on', r.trial_ends_on),
         s.sched, case when ch = 'in_app' then 'sent' else 'pending' end, case when ch = 'in_app' then s.sched end,
         'trial:' || r.id || ':' || r.trial_ends_on || ':' || ch
    from public.reminders r
    join public.profiles p on p.id = r.user_id and p.reminders_enabled
    cross join lateral (select ((r.trial_ends_on - 1) + r.remind_time) at time zone p.timezone as sched) s
    cross join lateral unnest(array['in_app']
         || case when p.channel_push  and 'push'  = any(r.channels) then array['push']  else array[]::text[] end
         || case when p.channel_email and 'email' = any(r.channels) then array['email'] else array[]::text[] end) as ch
   where r.is_active and r.remind_enabled and r.trial_ends_on is not null
     and s.sched between p_now - interval '24 hours' and p_now + interval '1 hour'
  on conflict (dedupe_key) do nothing;
  get diagnostics c = row_count; n := n + c;

  -- heti összefoglaló: vasárnap 18:00 helyi idő
  for u in select * from public.profiles where weekly_digest and reminders_enabled loop
    v_loc := p_now at time zone u.timezone;
    continue when extract(isodow from v_loc) <> 7;
    v_sched := (v_loc::date + time '18:00') at time zone u.timezone;
    continue when v_sched not between p_now - interval '24 hours' and p_now + interval '1 hour';
    select count(*)::int, coalesce(sum(amount_base), 0),
           coalesce(jsonb_agg(jsonb_build_object('name', reminder_name, 'due_date', due_date, 'amount_base', amount_base) order by due_date, reminder_name) filter (where rn <= 3), '[]'::jsonb)
      into cnt, tot, items
      from (select vo.*, row_number() over (order by vo.due_date, vo.reminder_name) rn
              from public.v_occurrences vo
             where vo.user_id = u.id and vo.status = 'upcoming'
               and vo.due_date between v_loc::date + 1 and v_loc::date + 7) q;
    continue when cnt = 0;
    chans := array['in_app'] || case when u.channel_push then array['push'] else array[]::text[] end
                             || case when u.channel_email then array['email'] else array[]::text[] end;
    foreach v_ch in array chans loop
      insert into public.notifications (user_id, kind, channel, payload, scheduled_for, status, sent_at, dedupe_key)
      values (u.id, 'digest', v_ch,
              jsonb_build_object('count', cnt, 'total', tot, 'base_currency', u.base_currency, 'items', items),
              v_sched, case when v_ch = 'in_app' then 'sent' else 'pending' end, case when v_ch = 'in_app' then v_sched end,
              'digest:' || u.id || ':' || to_char(v_loc::date, 'IYYY-"W"IW') || ':' || v_ch)
      on conflict (dedupe_key) do nothing;
      get diagnostics c = row_count; n := n + c;
    end loop;
  end loop;
  return n;
end $$;

-- napi karbantartás (cron): esedékességek + automatikus kifizetés + sor-újraépítés
create or replace function public.run_daily_maintenance(p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a int; b int; c int;
begin
  a := public.ensure_occurrences(null, 120, p_now);
  b := public.process_auto_paid(p_now);
  c := public.rebuild_notification_queue_all(p_now);
  return jsonb_build_object('occurrences_added', a, 'auto_paid', b, 'queue_rows', c);
end $$;

-- ───────── küldő: claim / finish / eszköz-eredmény ─────────
create or replace function public.claim_due_notifications(p_limit int default 100, p_now timestamptz default now())
returns setof public.notifications language plpgsql security definer set search_path = '' as $$
begin
  -- elavult (>24 óra) sor nem megy ki
  update public.notifications set status = 'expired'
   where channel in ('push', 'email') and status in ('pending', 'failed', 'sending') and scheduled_for < p_now - interval '24 hours';
  -- végleg beragadt (5+ próba, nem válaszolt)
  update public.notifications set status = 'failed', last_error = coalesce(last_error, 'stuck'), next_attempt_at = null
   where channel in ('push', 'email') and status = 'sending' and attempts >= 5 and claimed_at < p_now - interval '5 minutes';
  -- kapcsolók a KÜLDÉS pillanatában érvényesek
  update public.notifications n set status = 'cancelled'
   where n.channel in ('push', 'email') and n.status in ('pending', 'failed') and n.scheduled_for <= p_now
     and (
       not exists (select 1 from public.profiles p where p.id = n.user_id and p.reminders_enabled
                      and ((n.channel = 'push' and p.channel_push) or (n.channel = 'email' and p.channel_email)))
       or (n.reminder_id is not null and exists (select 1 from public.reminders r where r.id = n.reminder_id and (not r.is_active or not r.remind_enabled)))
       or (n.kind in ('reminder', 'overdue') and n.occurrence_id is not null
           and exists (select 1 from public.occurrences o where o.id = n.occurrence_id and o.status <> 'upcoming'))
     );
  return query
  update public.notifications n set status = 'sending', attempts = n.attempts + 1, claimed_at = p_now
   where n.id in (
     select x.id from public.notifications x
      where x.channel in ('push', 'email') and x.scheduled_for <= p_now
        and (x.status = 'pending'
             or (x.status = 'failed' and x.attempts < 5 and x.next_attempt_at <= p_now)
             or (x.status = 'sending' and x.claimed_at < p_now - interval '5 minutes' and x.attempts < 5))
      order by x.scheduled_for limit least(greatest(coalesce(p_limit, 100), 1), 500)
      for update skip locked)
  returning n.*;
end $$;

create or replace function public.finish_notification(p_id uuid, p_outcome text, p_error text default null, p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_outcome not in ('sent', 'retry', 'cancelled') then raise exception 'bad outcome %', p_outcome using errcode = '22023'; end if;
  update public.notifications set
    status = case p_outcome when 'sent' then 'sent' when 'cancelled' then 'cancelled' else 'failed' end,
    sent_at = case when p_outcome = 'sent' then p_now end,
    last_error = case when p_outcome = 'sent' then null else left(p_error, 300) end,
    next_attempt_at = case when p_outcome = 'retry' and attempts < 5 then p_now + make_interval(mins => power(2, attempts)::int) end
   where id = p_id and status = 'sending';
end $$;

create or replace function public.record_push_result(p_sub uuid, p_http int, p_now timestamptz default now())
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_http between 200 and 299 then
    update public.push_subscriptions set last_success_at = p_now, failed_count = 0 where id = p_sub;
  elsif p_http in (404, 410) then
    update public.push_subscriptions set disabled_at = coalesce(disabled_at, p_now) where id = p_sub;           -- halott endpoint
  elsif p_http = 429 or p_http >= 500 or p_http = 0 then
    null;                                                                                                       -- átmeneti: nem büntetjük az eszközt
  else
    update public.push_subscriptions set failed_count = failed_count + 1,
           disabled_at = case when failed_count + 1 >= 5 then coalesce(disabled_at, p_now) else disabled_at end
     where id = p_sub;
  end if;
end $$;

-- ───────── kifizetés-RPC-k frissítése: értesítések kezelése ─────────
create or replace function public.reminders_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ensure_occurrences(new.id);
  perform public.rebuild_notification_queue(new.id);
  return null;
end $$;

create or replace function public.profiles_after_update() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (old.reminders_enabled, old.channel_push, old.channel_email, old.timezone)
     is distinct from (new.reminders_enabled, new.channel_push, new.channel_email, new.timezone) then
    perform public.rebuild_notification_queue(id) from public.reminders where user_id = new.id and is_active;
  end if;
  return null;
end $$;
create trigger profiles_notif_sync after update on public.profiles for each row execute function public.profiles_after_update();

create or replace function public.mark_paid(p_occurrence_id uuid, p_paid_amount numeric default null, p_paid_on date default null)
returns public.occurrences language plpgsql security definer set search_path = '' as $$
declare o public.occurrences; tz text; today date;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_paid_amount is not null and p_paid_amount < 0 then raise exception 'paid_amount must be >= 0' using errcode = '22023'; end if;
  select timezone into tz from public.profiles where id = auth.uid();
  today := (now() at time zone coalesce(tz, 'UTC'))::date;
  if p_paid_on is not null and p_paid_on > today then raise exception 'paid_on cannot be in the future' using errcode = '22023'; end if;
  select * into o from public.occurrences where id = p_occurrence_id and user_id = auth.uid() for update;
  if not found then raise exception 'occurrence not found' using errcode = 'P0002'; end if;
  update public.occurrences
     set status = 'paid', paid_at = now(), paid_on = coalesce(p_paid_on, today), paid_amount = p_paid_amount, snoozed_until = null
   where id = o.id returning * into o;
  perform public.cancel_occurrence_notifications(o.id);
  return o;
end $$;

create or replace function public.skip_occurrence(p_occurrence_id uuid)
returns public.occurrences language plpgsql security definer set search_path = '' as $$
declare o public.occurrences;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.occurrences
     set status = 'skipped', paid_at = null, paid_on = null, paid_amount = null, snoozed_until = null
   where id = p_occurrence_id and user_id = auth.uid() returning * into o;
  if not found then raise exception 'occurrence not found' using errcode = 'P0002'; end if;
  perform public.cancel_occurrence_notifications(o.id);
  return o;
end $$;

create or replace function public.mark_unpaid(p_occurrence_id uuid)
returns public.occurrences language plpgsql security definer set search_path = '' as $$
declare o public.occurrences;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.occurrences
     set status = 'upcoming', paid_at = null, paid_on = null, paid_amount = null
   where id = p_occurrence_id and user_id = auth.uid() returning * into o;
  if not found then raise exception 'occurrence not found' using errcode = 'P0002'; end if;
  perform public.rebuild_notification_queue(o.reminder_id);
  return o;
end $$;

create or replace function public.process_auto_paid(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare cnt int; occ_id uuid;
begin
  cnt := 0;
  for occ_id in
    update public.occurrences o set status = 'paid', paid_on = o.due_date, paid_at = p_now
      from public.reminders r join public.profiles p on p.id = r.user_id
     where o.reminder_id = r.id and r.auto_paid and o.status = 'upcoming' and o.due_date <= (p_now at time zone p.timezone)::date
    returning o.id
  loop
    perform public.cancel_occurrence_notifications(occ_id, p_now); cnt := cnt + 1;
  end loop;
  return cnt;
end $$;

-- halasztás: új értesítés a megadott időpontra (alap: holnap a remind_time-kor a felhasználó időzónájában)
create or replace function public.snooze_occurrence(p_occurrence_id uuid, p_until timestamptz default null)
returns public.occurrences language plpgsql security definer set search_path = '' as $$
declare o public.occurrences; r public.reminders; p public.profiles; until_ts timestamptz; chans text[]; ch text;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into o from public.occurrences where id = p_occurrence_id and user_id = auth.uid() for update;
  if not found then raise exception 'occurrence not found' using errcode = 'P0002'; end if;
  if o.status <> 'upcoming' then raise exception 'only upcoming occurrences can be snoozed' using errcode = '22023'; end if;
  select * into r from public.reminders where id = o.reminder_id;
  select * into p from public.profiles where id = o.user_id;
  until_ts := coalesce(p_until, (((now() at time zone p.timezone)::date + 1) + r.remind_time) at time zone p.timezone);
  if until_ts < now() + interval '1 minute' or until_ts > now() + interval '30 days' then
    raise exception 'snooze time out of range' using errcode = '22023';
  end if;
  update public.occurrences set snoozed_until = until_ts where id = o.id returning * into o;
  chans := array['in_app'] || case when p.channel_push and 'push' = any(r.channels) then array['push'] else array[]::text[] end
                           || case when p.channel_email and 'email' = any(r.channels) then array['email'] else array[]::text[] end;
  if r.remind_enabled and p.reminders_enabled then
    foreach ch in array chans loop
      insert into public.notifications (user_id, kind, channel, reminder_id, occurrence_id, payload, scheduled_for, status, sent_at, dedupe_key)
      values (o.user_id, 'reminder', ch, r.id, o.id,
              jsonb_build_object('name', r.name, 'amount', o.amount, 'currency', o.currency, 'due_date', o.due_date, 'offset', null, 'snoozed', true, 'occ', o.id),
              until_ts, case when ch = 'in_app' then 'sent' else 'pending' end, case when ch = 'in_app' then until_ts end,
              'snz:' || o.id || ':' || extract(epoch from until_ts)::bigint || ':' || ch)
      on conflict (dedupe_key) do nothing;
    end loop;
  end if;
  return o;
end $$;

-- ───────── A-13: push / olvasottság / export / ICS ─────────
create or replace function public.register_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text, p_platform text default null, p_user_agent text default null, p_label text default null)
returns public.push_subscriptions language plpgsql security definer set search_path = '' as $$
declare s public.push_subscriptions; active int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select count(*) into active from public.push_subscriptions
   where user_id = auth.uid() and disabled_at is null and endpoint <> p_endpoint;
  if active >= 10 then raise exception 'device limit reached' using errcode = '53400'; end if;
  -- ugyanaz az eszköz/böngésző másik felhasználóra váltáskor átkerül (a korábbi felhasználó nem kap tovább push-t erre az eszközre)
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, platform, user_agent, label)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, p_platform, left(p_user_agent, 400), left(p_label, 80))
  on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
         platform = excluded.platform, user_agent = excluded.user_agent, label = coalesce(excluded.label, public.push_subscriptions.label),
         last_seen_at = now(), disabled_at = null, failed_count = 0
  returning * into s;
  return s;
end $$;

create or replace function public.unregister_push_subscription(p_endpoint text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
  get diagnostics n = row_count; return n > 0;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns int language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.notifications set read_at = now()
   where user_id = auth.uid() and channel = 'in_app' and status <> 'cancelled' and scheduled_for <= now()
     and read_at is null and (p_ids is null or id = any(p_ids));
  get diagnostics n = row_count; return n;
end $$;

create or replace function public.unread_notifications() returns int
language sql stable security invoker set search_path = '' as $$
  select count(*)::int from public.notifications
   where user_id = auth.uid() and channel = 'in_app' and status <> 'cancelled' and scheduled_for <= now() and read_at is null
$$;

create or replace function public.rotate_ics_token() returns text
language plpgsql security definer set search_path = '' as $$
declare t text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.profiles set ics_token = t where id = auth.uid();
  return t;
end $$;

-- naptár-feed: a tokenhez tartozó felhasználó aktív emlékeztetőinek esedékességei (−30 … +365 nap), minimális adattal
create or replace function public.ics_feed(p_token text)
returns table (uid text, due_date date, name text, amount numeric, currency text, offset_days smallint, remind boolean)
language sql stable security definer set search_path = '' as $$
  select 'occ-' || o.id || '@bankreminder', o.due_date, r.name, coalesce(o.paid_amount, o.amount), o.currency::text,
         coalesce(r.remind_offsets[1], 1::smallint), (r.remind_enabled and p.reminders_enabled)
    from public.profiles p
    join public.occurrences o on o.user_id = p.id
    join public.reminders r on r.id = o.reminder_id and r.is_active
   where p_token is not null and length(p_token) >= 32 and p.ics_token = p_token and o.status <> 'skipped'
     and o.due_date between (now() at time zone p.timezone)::date - 30 and (now() at time zone p.timezone)::date + 365
   order by o.due_date, r.name
$$;

create or replace function public.export_my_data() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare u uuid := auth.uid();
begin
  if u is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile',     (select to_jsonb(p) - 'ics_token' from public.profiles p where p.id = u),
    'categories',  coalesce((select jsonb_agg(to_jsonb(c)) from public.categories c where c.user_id = u), '[]'),
    'reminders',   coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at) from public.reminders r where r.user_id = u), '[]'),
    'occurrences', coalesce((select jsonb_agg(to_jsonb(o) order by o.due_date) from public.occurrences o where o.user_id = u), '[]'),
    'expenses',    coalesce((select jsonb_agg(to_jsonb(e) order by e.spent_on) from public.expenses e where e.user_id = u), '[]'),
    'budgets',     coalesce((select jsonb_agg(to_jsonb(b)) from public.budgets b where b.user_id = u), '[]'),
    'savings_goals', coalesce((select jsonb_agg(to_jsonb(g)) from public.savings_goals g where g.user_id = u), '[]'),
    'goal_contributions', coalesce((select jsonb_agg(to_jsonb(gc) order by gc.contributed_on) from public.goal_contributions gc where gc.user_id = u), '[]'),
    'devices',     coalesce((select jsonb_agg(jsonb_build_object('platform', s.platform, 'label', s.label, 'created_at', s.created_at)) from public.push_subscriptions s where s.user_id = u), '[]'),
    'tips',        coalesce((select jsonb_agg(to_jsonb(t)) from public.tips t where t.user_id = u), '[]')
  );
end $$;

-- ───────── jogosultságok ─────────
revoke execute on function
  public.cancel_occurrence_notifications(uuid, timestamptz), public.rebuild_notification_queue(uuid, timestamptz),
  public.rebuild_notification_queue_all(timestamptz), public.enqueue_extra_notifications(timestamptz),
  public.run_daily_maintenance(timestamptz), public.claim_due_notifications(int, timestamptz),
  public.finish_notification(uuid, text, text, timestamptz), public.record_push_result(uuid, int, timestamptz),
  public.profiles_after_update()
  from public, anon, authenticated;
grant execute on function
  public.rebuild_notification_queue(uuid, timestamptz), public.rebuild_notification_queue_all(timestamptz),
  public.enqueue_extra_notifications(timestamptz), public.run_daily_maintenance(timestamptz),
  public.claim_due_notifications(int, timestamptz), public.finish_notification(uuid, text, text, timestamptz),
  public.record_push_result(uuid, int, timestamptz), public.cancel_occurrence_notifications(uuid, timestamptz)
  to service_role;

revoke execute on function
  public.mark_paid(uuid, numeric, date), public.mark_unpaid(uuid), public.skip_occurrence(uuid), public.snooze_occurrence(uuid, timestamptz),
  public.register_push_subscription(text, text, text, text, text, text), public.unregister_push_subscription(text),
  public.mark_notifications_read(uuid[]), public.unread_notifications(), public.rotate_ics_token(), public.export_my_data()
  from public, anon;
grant execute on function
  public.mark_paid(uuid, numeric, date), public.mark_unpaid(uuid), public.skip_occurrence(uuid), public.snooze_occurrence(uuid, timestamptz),
  public.register_push_subscription(text, text, text, text, text, text), public.unregister_push_subscription(text),
  public.mark_notifications_read(uuid[]), public.unread_notifications(), public.rotate_ics_token(), public.export_my_data()
  to authenticated;

revoke execute on function public.ics_feed(text) from public;
grant execute on function public.ics_feed(text) to anon, authenticated;

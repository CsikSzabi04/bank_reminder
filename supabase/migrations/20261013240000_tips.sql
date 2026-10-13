-- A-21: tippek-motor (P0 szabályok) — ARCHITECTURE.md §17. Determinisztikus SQL; a DB kódot+paramétert tárol, a szöveg a kliens locales-ából jön (H7).
-- A „fedett előfizetés" szabály a FELHASZNÁLÓ saját megjelölésére épül (usage_tags), nem kitalált katalógus-tényre.
-- Címke-szótár (a UI chipjei): movies, series, originals, sports, kids, documentary, music, other. Az `originals` kizárólagosnak számít (nem fedhető le másik szolgáltatással).

-- ───────── küszöbök ─────────
create table public.tip_config (key text primary key, value numeric not null, note text);
alter table public.tip_config enable row level security;     -- nincs policy: csak a security definer függvények / service_role éri el
revoke all on public.tip_config from anon, authenticated;
insert into public.tip_config (key, value, note) values
  ('price_increase_pct', 5,  'árváltozás-küszöb (%)'),
  ('subs_share_pct',     15, 'előfizetések részesedése a havi kiadásból (%)'),
  ('trial_days',         3,  'próbaidő-lejárat előzetes jelzése (nap)'),
  ('unused_ask_days',    90, 'használat-ellenőrzés gyakorisága (nap)'),
  ('late_min_count',     2,  'késedelmes fizetések minimuma'),
  ('late_window',        6,  'az utolsó ennyi esedékességet nézzük')
on conflict (key) do nothing;

create or replace function public.tip_cfg(p_key text) returns numeric
language sql stable security definer set search_path = '' as $$ select value from public.tip_config where key = p_key $$;
revoke execute on function public.tip_cfg(text) from public, anon, authenticated;

-- ───────── használat-ellenőrzés (előfizetésenként) ─────────
create table public.usage_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  used boolean not null,
  answered_at timestamptz not null default now()
);
create index usage_checks_reminder on public.usage_checks (reminder_id, answered_at desc);
alter table public.usage_checks enable row level security;
create policy usage_checks_select on public.usage_checks for select to authenticated using ((select auth.uid()) = user_id);
revoke insert, update, delete, truncate on public.usage_checks from authenticated;
revoke all on public.usage_checks from anon;

-- ───────── segédek ─────────
create or replace function public.monthly_equivalent(p_amount numeric, p_currency text, p_unit text, p_every int, p_base text, p_on date)
returns numeric language sql stable set search_path = '' as $$
  select public.fx_convert(p_amount, p_currency, p_base, p_on)
         * case p_unit when 'month' then 1.0 / p_every when 'year' then 1.0 / (12 * p_every)
                       when 'week' then (52.0 / 12) / p_every when 'day' then (365.0 / 12) / p_every end
$$;

-- budget_status: felhasználó-paraméteres változat (a tippek háttérből is hívják); a régi név burkoló marad
create or replace function public.budget_status_for(p_user uuid, p_month date, p_today date)
returns table (budget_id uuid, category_id uuid, monthly_limit numeric, spent numeric, committed numeric,
               "left" numeric, state text, forecast numeric, suggested_limit numeric)
language plpgsql stable security definer set search_path = '' as $$
declare ms date; me date; dim int; elapsed int; base text; is_current boolean;
begin
  ms := public.month_start(coalesce(p_month, p_today));
  me := (ms + interval '1 month')::date - 1;
  dim := (me - ms) + 1;
  is_current := p_today between ms and me;
  elapsed := case when is_current then (p_today - ms) + 1 end;
  select base_currency into base from public.profiles where id = p_user;
  return query
  with b as (
    select bd.id, bd.category_id, public.fx_convert(bd.monthly_limit, bd.currency, base, p_today) as lim
      from public.budgets bd where bd.user_id = p_user),
  cur as (
    select i.category_id,
           coalesce(sum(i.amount_base) filter (where i.status = 'paid'), 0)     as spent,
           coalesce(sum(i.amount_base) filter (where i.status = 'upcoming'), 0) as committed,
           coalesce(sum(i.amount_base) filter (where i.kind = 'expense'), 0)    as exp_spent
      from public.v_items i
     where i.user_id = p_user and i.status <> 'skipped' and i.on_date between ms and me
     group by i.category_id),
  prev as (
    select i.category_id, coalesce(sum(i.amount_base), 0) / 3.0 as avg3
      from public.v_items i
     where i.user_id = p_user and i.status <> 'skipped'
       and i.on_date >= (ms - interval '3 months')::date and i.on_date < ms
     group by i.category_id)
  select b.id, b.category_id, b.lim,
         coalesce(cur.spent, 0), coalesce(cur.committed, 0),
         b.lim - coalesce(cur.spent, 0),
         case when b.lim is null then 'ok'
              when coalesce(cur.spent, 0) > b.lim then 'over'
              when coalesce(cur.spent, 0) + coalesce(cur.committed, 0) > b.lim or coalesce(cur.spent, 0) >= 0.8 * b.lim then 'watch'
              else 'ok' end,
         case when is_current and coalesce(cur.exp_spent, 0) > 0
              then round(cur.exp_spent / elapsed * dim + (cur.spent - cur.exp_spent) + cur.committed, 2) end,
         case when coalesce(prev.avg3, 0) > 0
              then (ceil(prev.avg3 / case when base = 'HUF' then 1000 else 10 end) * case when base = 'HUF' then 1000 else 10 end)::numeric end
    from b left join cur on cur.category_id = b.category_id left join prev on prev.category_id = b.category_id
   order by (coalesce(cur.spent, 0) + coalesce(cur.committed, 0)) / nullif(b.lim, 0) desc nulls last, b.id;
end $$;
revoke execute on function public.budget_status_for(uuid, date, date) from public, anon, authenticated;

create or replace function public.budget_status(p_month date default null)
returns table (budget_id uuid, category_id uuid, monthly_limit numeric, spent numeric, committed numeric,
               "left" numeric, state text, forecast numeric, suggested_limit numeric)
language plpgsql stable set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return query select * from public.budget_status_for(auth.uid(), p_month, public.user_today());
end $$;

-- ───────── a motor ─────────
create or replace function public.compute_tips(p_user uuid, p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare
  prof public.profiles; today date; ms date; me date; n int := 0; month_total numeric; subs_total numeric; subs_count int;
  ov text[] := array['video_streaming', 'music_streaming', 'cloud_storage', 'game_subscription'];
begin
  select * into prof from public.profiles where id = p_user;
  if not found then return 0; end if;
  today := (p_now at time zone prof.timezone)::date;
  ms := public.month_start(today); me := (ms + interval '1 month')::date - 1;

  update public.tips set status = 'new', snoozed_until = null where user_id = p_user and status = 'snoozed' and snoozed_until <= today;
  if not prof.tips_enabled then
    delete from public.tips where user_id = p_user and status in ('new', 'seen');
    return 0;
  end if;

  create temp table if not exists tip_cand (code text, severity text, params jsonb, est numeric, reminder_ids uuid[], fingerprint text) on commit drop;
  create temp table if not exists tip_subs (id uuid, name text, group_key text, usage_tags text[], monthly numeric, created_at timestamptz,
                                            annual_discount_pct numeric, recur_unit text, recur_every smallint) on commit drop;
  truncate tip_cand; truncate tip_subs;

  insert into tip_subs
  select r.id, r.name, sc.group_key, r.usage_tags,
         public.monthly_equivalent(r.amount, r.currency, r.recur_unit, r.recur_every, prof.base_currency, today),
         r.created_at, sc.annual_discount_pct, r.recur_unit, r.recur_every
    from public.reminders r left join public.service_catalog sc on sc.slug = r.service_slug
   where r.user_id = p_user and r.is_active and r.is_subscription and r.recur_unit is not null;
  delete from tip_subs where monthly is null;

  -- 1) átfedő előfizetések ugyanabban a csoportban
  insert into tip_cand
  select 'sub_overlap_group', 'save',
         jsonb_build_object('group', group_key, 'names', jsonb_agg(name order by name), 'monthly_total', round(sum(monthly), 2), 'count', count(*), 'currency', prof.base_currency),
         round(min(monthly), 2), array_agg(id order by name), 'overlap:' || group_key
    from tip_subs where group_key = any(ov) group by group_key having count(*) >= 2;

  -- 2) rákérdezés: mit használsz ezen? (csak átfedő csoportban, ha még nincs megjelölve)
  insert into tip_cand
  select 'sub_maybe_redundant', 'info', jsonb_build_object('name', s.name, 'group', s.group_key), null, array[s.id], 'ask_usage:' || s.id
    from tip_subs s
   where s.group_key = any(ov) and cardinality(s.usage_tags) = 0
     and (select count(*) from tip_subs x where x.group_key = s.group_key) >= 2;

  -- 3) fedett előfizetés: minden általad megjelölt használatot a csoport másik tagja is lefed (az `originals` kizárólagos)
  with grp as (select group_key from tip_subs where group_key = any(ov) group by group_key having count(*) >= 2),
  cov as (
    select s.* from tip_subs s join grp using (group_key)
     where cardinality(s.usage_tags) > 0 and not ('originals' = any(s.usage_tags))
       and not exists (select 1 from unnest(s.usage_tags) t
                        where not exists (select 1 from tip_subs o where o.group_key = s.group_key and o.id <> s.id and t = any(o.usage_tags)))),
  pick as (select cov.*, row_number() over (partition by group_key order by monthly desc, name) rn from cov)
  insert into tip_cand
  select 'sub_covered_by_others', 'save',
         jsonb_build_object('name', p.name, 'tags', to_jsonb(p.usage_tags), 'currency', prof.base_currency,
                            'covered_by', (select jsonb_agg(o.name order by o.name) from tip_subs o where o.group_key = p.group_key and o.id <> p.id and o.usage_tags && p.usage_tags)),
         round(p.monthly, 2), array[p.id], 'covered:' || p.id
    from pick p where p.rn = 1;

  -- 4) éves csomag olcsóbb (csak ha a katalógusban ellenőrzött kedvezmény van)
  insert into tip_cand
  select 'sub_annual_cheaper', 'save',
         jsonb_build_object('name', name, 'pct', annual_discount_pct, 'yearly_saving', round(monthly * 12 * annual_discount_pct / 100, 2), 'currency', prof.base_currency),
         round(monthly * annual_discount_pct / 100, 2), array[id], 'annual:' || id
    from tip_subs where annual_discount_pct > 0 and recur_unit = 'month' and recur_every = 1;

  -- 5) árváltozás: a legutóbbi esedékesség ≥ küszöb %-kal drágább az előzőnél
  insert into tip_cand
  select 'price_increase', 'warn',
         jsonb_build_object('name', r.name, 'old', x.prev_amount, 'new', x.amount, 'currency', x.currency, 'pct', round((x.amount - x.prev_amount) / x.prev_amount * 100, 1)),
         round(public.monthly_equivalent(x.amount - x.prev_amount, x.currency, r.recur_unit, r.recur_every, prof.base_currency, today), 2),
         array[r.id], 'price_up:' || r.id || ':' || x.id
    from (select o.*, lag(o.amount) over w as prev_amount, lag(o.currency) over w as prev_cur,
                 row_number() over (partition by o.reminder_id order by o.due_date desc) as rn
            from public.occurrences o
           where o.user_id = p_user and o.status <> 'skipped' and o.due_date <= today + 35
          window w as (partition by o.reminder_id order by o.due_date)) x
    join public.reminders r on r.id = x.reminder_id and r.is_active
   where x.rn = 1 and x.prev_amount > 0 and x.currency = x.prev_cur
     and x.amount > x.prev_amount * (1 + public.tip_cfg('price_increase_pct') / 100.0);

  -- 6) próbaidő lejár
  insert into tip_cand
  select 'trial_ending', 'warn', jsonb_build_object('name', name, 'date', trial_ends_on, 'amount_after', amount, 'currency', currency), null, array[id], 'trial:' || id || ':' || trial_ends_on
    from public.reminders
   where user_id = p_user and is_active and trial_ends_on between today and today + public.tip_cfg('trial_days')::int;

  -- 7) az előfizetések részesedése a havi kiadásból
  select coalesce(sum(amount_base), 0) into month_total from public.v_items where user_id = p_user and status <> 'skipped' and on_date between ms and me;
  select coalesce(sum(monthly), 0), count(*) into subs_total, subs_count from tip_subs;
  if month_total > 0 and subs_count >= 2 and subs_total / month_total * 100 >= public.tip_cfg('subs_share_pct') then
    insert into tip_cand values ('subs_share_high', 'info',
      jsonb_build_object('pct', round(subs_total / month_total * 100, 1), 'monthly', round(subs_total, 2), 'yearly', round(subs_total * 12, 2), 'currency', prof.base_currency),
      null, '{}', 'subs_share');
  end if;

  -- 8) használat-ellenőrzés és „nem használod" (2× nem)
  insert into tip_cand
  select 'unused_check', 'info', jsonb_build_object('name', s.name), null, array[s.id], 'unused_check:' || s.id || ':' || coalesce(c.cnt, 0)
    from tip_subs s
    left join lateral (select count(*) as cnt, max(answered_at) as last from public.usage_checks u where u.reminder_id = s.id) c on true
   where s.created_at < p_now - interval '30 days'
     and (c.last is null or c.last < p_now - make_interval(days => public.tip_cfg('unused_ask_days')::int));
  insert into tip_cand
  select 'sub_unused', 'save', jsonb_build_object('name', s.name, 'currency', prof.base_currency), round(s.monthly, 2), array[s.id],
         'unused:' || s.id || ':' || (select count(*) from public.usage_checks u where u.reminder_id = s.id)
    from tip_subs s
    join lateral (select count(*) as cnt, bool_or(used) as any_used
                    from (select used from public.usage_checks u where u.reminder_id = s.id order by answered_at desc limit 2) l) c on true
   where c.cnt = 2 and not c.any_used;

  -- 9) keretek
  insert into tip_cand
  select 'budget_over_now', 'warn', jsonb_build_object('category_id', b.category_id, 'over', round(b.spent - b.monthly_limit, 2), 'currency', prof.base_currency),
         null, '{}', 'budget_over:' || b.category_id || ':' || to_char(ms, 'YYYY-MM')
    from public.budget_status_for(p_user, ms, today) b where b.state = 'over';
  insert into tip_cand
  select 'budget_forecast_over', 'warn',
         jsonb_build_object('category_id', b.category_id, 'forecast', b.forecast, 'limit', b.monthly_limit, 'currency', prof.base_currency),
         null, '{}', 'budget_fc:' || b.category_id || ':' || to_char(ms, 'YYYY-MM')
    from public.budget_status_for(p_user, ms, today) b
   where b.forecast is not null and b.monthly_limit is not null and b.forecast > b.monthly_limit and b.state <> 'over';

  -- 10) duplikált emlékeztető (azonos összeg + egymás előtagja a név)
  insert into tip_cand
  select 'duplicate_reminder', 'warn', jsonb_build_object('a', a.name, 'b', b.name), null, array[a.id, b.id], 'dup:' || a.id || ':' || b.id
    from public.reminders a
    join public.reminders b on b.user_id = a.user_id and a.id < b.id and b.is_active and a.amount = b.amount and a.currency = b.currency
    cross join lateral (select regexp_replace(lower(a.name), '[^a-z0-9áéíóöőúüű]', '', 'g') as na, regexp_replace(lower(b.name), '[^a-z0-9áéíóöőúüű]', '', 'g') as nb) n
   where a.user_id = p_user and a.is_active and length(least(n.na, n.nb)) >= 4 and (n.na like n.nb || '%' or n.nb like n.na || '%');

  -- 11) késedelmes fizetés-minta
  insert into tip_cand
  select 'late_payment_pattern', 'info', jsonb_build_object('name', r.name, 'count', l.cnt), null, array[r.id], 'late:' || r.id
    from public.reminders r
    join lateral (select count(*) filter (where x.status = 'paid' and x.paid_on > x.due_date) as cnt
                    from (select o.status, o.paid_on, o.due_date from public.occurrences o
                           where o.reminder_id = r.id and o.status <> 'skipped' and o.due_date < today
                           order by o.due_date desc limit public.tip_cfg('late_window')::int) x) l on true
   where r.user_id = p_user and r.is_active and l.cnt >= public.tip_cfg('late_min_count');

  -- szinkron: ami már nem igaz (és nem döntött róla a felhasználó) törlődik; a többi upsert
  delete from public.tips t where t.user_id = p_user and t.status in ('new', 'seen')
     and not exists (select 1 from tip_cand c where c.fingerprint = t.fingerprint);
  insert into public.tips (user_id, code, severity, params, est_monthly_saving, reminder_ids, fingerprint)
  select distinct on (c.fingerprint) p_user, c.code, c.severity, c.params, c.est, c.reminder_ids, c.fingerprint from tip_cand c
  on conflict (user_id, fingerprint) do update
     set severity = excluded.severity, params = excluded.params, est_monthly_saving = excluded.est_monthly_saving, reminder_ids = excluded.reminder_ids
   where public.tips.status in ('new', 'seen');
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.refresh_tips() returns int
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  return public.compute_tips(auth.uid());
end $$;

create or replace function public.refresh_tips_all(p_now timestamptz default now()) returns int
language plpgsql security definer set search_path = '' as $$
declare u uuid; n int := 0;
begin
  for u in select id from public.profiles loop n := n + public.compute_tips(u, p_now); end loop;
  return n;
end $$;

create or replace function public.tip_action(p_tip_id uuid, p_action text) returns public.tips
language plpgsql security definer set search_path = '' as $$
declare t public.tips; today date;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if p_action not in ('seen', 'dismiss', 'snooze', 'done') then raise exception 'bad action %', p_action using errcode = '22023'; end if;
  today := public.user_today();
  update public.tips set
    status = case p_action when 'seen' then case when status = 'new' then 'seen' else status end
                          when 'dismiss' then 'dismissed' when 'snooze' then 'snoozed' else 'done' end,
    snoozed_until = case when p_action = 'snooze' then today + 30 else null end
   where id = p_tip_id and user_id = auth.uid() returning * into t;
  if not found then raise exception 'tip not found' using errcode = 'P0002'; end if;
  return t;
end $$;

-- „Használtad az elmúlt hónapban?" válasz → a kapcsolódó kérdés-tipp lezárul, a tippek frissülnek
create or replace function public.answer_usage_check(p_reminder_id uuid, p_used boolean) returns int
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not exists (select 1 from public.reminders where id = p_reminder_id and user_id = auth.uid()) then
    raise exception 'reminder not found' using errcode = 'P0002';
  end if;
  insert into public.usage_checks (user_id, reminder_id, used) values (auth.uid(), p_reminder_id, p_used);
  update public.tips set status = 'done' where user_id = auth.uid() and fingerprint like 'unused_check:' || p_reminder_id || ':%' and status in ('new', 'seen');
  return public.compute_tips(auth.uid());
end $$;

-- ───────── jogosultságok + éjszakai ütemezés ─────────
revoke execute on function public.compute_tips(uuid, timestamptz), public.refresh_tips_all(timestamptz) from public, anon, authenticated;
grant  execute on function public.compute_tips(uuid, timestamptz), public.refresh_tips_all(timestamptz) to service_role;
revoke execute on function public.refresh_tips(), public.tip_action(uuid, text), public.answer_usage_check(uuid, boolean),
  public.monthly_equivalent(numeric, text, text, int, text, date), public.budget_status(date) from public, anon;
grant  execute on function public.refresh_tips(), public.tip_action(uuid, text), public.answer_usage_check(uuid, boolean),
  public.monthly_equivalent(numeric, text, text, int, text, date), public.budget_status(date) to authenticated;

do $$ begin
  if exists (select 1 from cron.job where jobname = 'tips_nightly') then perform cron.unschedule('tips_nightly'); end if;
end $$;
select cron.schedule('tips_nightly', '30 3 * * *', $$select public.refresh_tips_all()$$);

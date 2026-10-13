-- A-10: analitika-RPC-k + dashboard_summary (ARCHITECTURE.md §15, §21.2).
-- Szabály (DECISIONS.md): a számla a LEJÁRATI hónapjához tartozik (due_date), a gyors kiadás a spent_on hónapjához;
-- a kihagyott (skipped) tétel nem számít. Összegek az alap-pénznemben (fx_convert); hiányzó árfolyam → NULL → az összegből kimarad,
-- a dashboard_summary.hero.unconverted jelzi a darabszámot.

create or replace function public.month_start(d date) returns date
language sql immutable set search_path = '' as $$ select d - (extract(day from d)::int - 1) $$;

create or replace function public.group_key(p_slot int) returns text
language sql immutable set search_path = '' as $$
  select case p_slot when 1 then 'subscriptions' when 2 then 'housing' when 3 then 'telecom' when 4 then 'insurance_tax'
                     when 5 then 'loans_fees' when 6 then 'everyday' when 7 then 'lifestyle' else 'other' end $$;

create or replace function public.user_today() returns date
language sql stable set search_path = '' as $$
  select (now() at time zone coalesce((select timezone from public.profiles where id = auth.uid()), 'UTC'))::date $$;

-- egységes költség-tételek: számlák (esedékességek) + gyors kiadások
create or replace view public.v_items with (security_invoker = true) as
select 'bill'::text as kind, o.id as item_id, o.user_id, o.reminder_id, r.name, r.category_id,
       coalesce(c.color_slot, 9)::int as group_slot, r.is_subscription,
       o.due_date as on_date, o.status, o.currency::text as currency,
       case when o.status = 'paid' then coalesce(o.paid_amount, o.amount) else o.amount end as amount_native,
       public.fx_convert(case when o.status = 'paid' then coalesce(o.paid_amount, o.amount) else o.amount end,
                         o.currency, p.base_currency, coalesce(o.paid_on, o.due_date)) as amount_base
  from public.occurrences o
  join public.reminders r on r.id = o.reminder_id
  join public.profiles  p on p.id = o.user_id
  left join public.categories c on c.id = r.category_id
union all
select 'expense'::text, e.id, e.user_id, null::uuid, coalesce(e.note, c.name_hu, c.name_en, 'expense'), e.category_id,
       coalesce(c.color_slot, 9)::int, false, e.spent_on, 'paid'::text, e.currency::text, e.amount,
       public.fx_convert(e.amount, e.currency, p.base_currency, e.spent_on)
  from public.expenses e
  join public.profiles p on p.id = e.user_id
  left join public.categories c on c.id = e.category_id;

-- C1: kategória-csoportok
create or replace function public.analytics_by_group(p_from date, p_to date)
returns table (group_slot int, group_key text, total numeric, paid numeric, remaining numeric, items int)
language sql stable set search_path = '' as $$
  select i.group_slot, public.group_key(i.group_slot),
         coalesce(sum(i.amount_base), 0),
         coalesce(sum(i.amount_base) filter (where i.status = 'paid'), 0),
         coalesce(sum(i.amount_base) filter (where i.status = 'upcoming'), 0),
         count(*)::int
    from public.v_items i
   where i.user_id = auth.uid() and i.on_date between p_from and p_to and i.status <> 'skipped'
   group by i.group_slot
   order by 3 desc, 1
$$;

-- C2: havi trend (az aktuális hónappal záródó p_months hónap, növekvő sorrend)
create or replace function public.analytics_monthly_trend(p_months int)
returns table (month date, paid numeric, remaining numeric)
language sql stable set search_path = '' as $$
  with m as (
    select (public.month_start(public.user_today()) - make_interval(months => g))::date as month
      from generate_series(0, least(greatest(coalesce(p_months, 6), 1), 36) - 1) g)
  select m.month,
         coalesce(sum(i.amount_base) filter (where i.status = 'paid'), 0),
         coalesce(sum(i.amount_base) filter (where i.status = 'upcoming'), 0)
    from m left join public.v_items i
      on i.user_id = auth.uid() and i.status <> 'skipped' and public.month_start(i.on_date) = m.month
   group by m.month order by m.month
$$;

-- C3: a hónap lefutása (kumulatív), az előző hónappal összevetve
create or replace function public.analytics_cumulative(p_month date)
returns table (day date, cum_this numeric, cum_prev numeric)
language sql stable set search_path = '' as $$
  with b as (
    select public.month_start(p_month) as ms,
           (public.month_start(p_month) + interval '1 month')::date - 1 as me,
           (public.month_start(p_month) - interval '1 month')::date as pms,
           public.month_start(p_month) - 1 as pme),
  daily as (
    select i.on_date, sum(i.amount_base) as s
      from public.v_items i, b
     where i.user_id = auth.uid() and i.status <> 'skipped' and i.on_date between b.pms and b.me
     group by i.on_date)
  select d.day,
         (select coalesce(sum(s), 0) from daily where on_date between b.ms and d.day),
         case when b.pms + (d.day - b.ms) <= b.pme
              then (select coalesce(sum(s), 0) from daily where on_date between b.pms and b.pms + (d.day - b.ms)) end
    from b, lateral (select generate_series(b.ms, b.me, interval '1 day')::date as day) d
   order by d.day
$$;

-- C4: top tételek (számlák, emlékeztetőnként összegezve)
create or replace function public.analytics_top(p_from date, p_to date, p_limit int default 5)
returns table (reminder_id uuid, name text, group_slot int, total numeric)
language sql stable set search_path = '' as $$
  select i.reminder_id, max(i.name), max(i.group_slot), coalesce(sum(i.amount_base), 0)
    from public.v_items i
   where i.user_id = auth.uid() and i.kind = 'bill' and i.status <> 'skipped' and i.on_date between p_from and p_to
   group by i.reminder_id
   order by 4 desc, 2
   limit least(greatest(coalesce(p_limit, 5), 1), 50)
$$;

-- C5: kategória-csoportok alakulása
create or replace function public.analytics_group_trend(p_months int)
returns table (month date, group_slot int, total numeric)
language sql stable set search_path = '' as $$
  select public.month_start(i.on_date), i.group_slot, coalesce(sum(i.amount_base), 0)
    from public.v_items i
   where i.user_id = auth.uid() and i.status <> 'skipped'
     and i.on_date >= (public.month_start(public.user_today()) - make_interval(months => least(greatest(coalesce(p_months, 6), 1), 36) - 1))::date
     and i.on_date <= (public.month_start(public.user_today()) + interval '1 month')::date - 1
   group by 1, 2 order by 1, 2
$$;

-- C6: következő napok (még ki nem fizetett tételek, nullás napokkal együtt)
create or replace function public.upcoming_days(p_days int default 30)
returns table (day date, total numeric, items int)
language sql stable set search_path = '' as $$
  select d.day, coalesce(sum(i.amount_base), 0), count(i.item_id)::int
    from generate_series(public.user_today(), public.user_today() + (least(greatest(coalesce(p_days, 30), 1), 120) - 1), interval '1 day') g,
         lateral (select g::date as day) d
    left join public.v_items i on i.user_id = auth.uid() and i.kind = 'bill' and i.status = 'upcoming' and i.on_date = d.day
   group by d.day order by d.day
$$;

-- C7: előfizetés-költség (havi egyenérték, éves, részesedés az előfizetések között)
create or replace function public.analytics_subscriptions()
returns table (reminder_id uuid, name text, service_slug text, monthly numeric, yearly numeric, share_pct numeric)
language sql stable set search_path = '' as $$
  with s as (
    select r.id, r.name, r.service_slug,
           public.fx_convert(r.amount, r.currency, p.base_currency, public.user_today())
           * case r.recur_unit when 'month' then 1.0 / r.recur_every
                               when 'year'  then 1.0 / (12 * r.recur_every)
                               when 'week'  then (52.0 / 12) / r.recur_every
                               when 'day'   then (365.0 / 12) / r.recur_every end as monthly
      from public.reminders r join public.profiles p on p.id = r.user_id
     where r.user_id = auth.uid() and r.is_active and r.is_subscription and r.recur_unit is not null)
  select s.id, s.name, s.service_slug, round(s.monthly, 2), round(s.monthly * 12, 2),
         round(s.monthly / nullif(sum(s.monthly) over (), 0) * 100, 2)
    from s where s.monthly is not null order by s.monthly desc, s.name
$$;

-- Főoldal: minden egy hívásban (a budgets/tip helyőrző: A-11 / A-21 bővíti)
create or replace function public.dashboard_summary(p_month date default null)
returns jsonb language plpgsql stable set search_path = '' as $$
declare
  ms date; me date; pms date; pme date; base text;
  tot numeric; paid numeric; rem numeric; ptot numeric; unconv int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  ms := public.month_start(coalesce(p_month, public.user_today()));
  me := (ms + interval '1 month')::date - 1;
  pms := (ms - interval '1 month')::date; pme := ms - 1;
  select base_currency into base from public.profiles where id = auth.uid();

  select coalesce(sum(amount_base), 0), coalesce(sum(amount_base) filter (where status = 'paid'), 0),
         coalesce(sum(amount_base) filter (where status = 'upcoming'), 0), (count(*) filter (where amount_base is null))::int
    into tot, paid, rem, unconv
    from public.v_items where user_id = auth.uid() and status <> 'skipped' and on_date between ms and me;
  select coalesce(sum(amount_base), 0) into ptot
    from public.v_items where user_id = auth.uid() and status <> 'skipped' and on_date between pms and pme;

  return jsonb_build_object(
    'month', ms,
    'base_currency', base,
    'hero', jsonb_build_object('total', tot, 'paid', paid, 'remaining', rem, 'prev_total', ptot,
                               'delta_pct', case when ptot > 0 then round((tot - ptot) / ptot * 100, 1) end,
                               'unconverted', unconv),
    'groups', coalesce((select jsonb_agg(to_jsonb(g)) from public.analytics_by_group(ms, me) g), '[]'::jsonb),
    'upcoming', coalesce((
        select jsonb_agg(to_jsonb(u)) from (
          select id as occurrence_id, reminder_id, reminder_name as name, due_date, amount, currency, amount_base,
                 overdue, is_subscription, category_id, service_slug
            from public.v_occurrences where user_id = auth.uid() and status = 'upcoming'
           order by due_date, reminder_name limit 5) u), '[]'::jsonb),
    'subscriptions', (
        select jsonb_build_object(
                 'monthly_total', coalesce(sum(monthly), 0), 'yearly_total', coalesce(sum(yearly), 0), 'count', count(*),
                 'items', coalesce((select jsonb_agg(jsonb_build_object('reminder_id', x.reminder_id, 'name', x.name,
                                      'service_slug', x.service_slug, 'monthly', x.monthly)) from (select * from public.analytics_subscriptions() limit 6) x), '[]'::jsonb))
          from public.analytics_subscriptions()),
    'budgets', '[]'::jsonb,
    'tip', null
  );
end $$;

-- ───────── jogosultságok ─────────
revoke all on public.v_items from anon;
grant select on public.v_items to authenticated;
revoke execute on function
  public.month_start(date), public.group_key(int), public.user_today(),
  public.analytics_by_group(date, date), public.analytics_monthly_trend(int), public.analytics_cumulative(date),
  public.analytics_top(date, date, int), public.analytics_group_trend(int), public.upcoming_days(int),
  public.analytics_subscriptions(), public.dashboard_summary(date)
  from public, anon;
grant execute on function
  public.month_start(date), public.group_key(int), public.user_today(),
  public.analytics_by_group(date, date), public.analytics_monthly_trend(int), public.analytics_cumulative(date),
  public.analytics_top(date, date, int), public.analytics_group_trend(int), public.upcoming_days(int),
  public.analytics_subscriptions(), public.dashboard_summary(date)
  to authenticated;

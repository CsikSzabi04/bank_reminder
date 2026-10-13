-- A-11: költségkeret-állapot, megtakarítási célok haladása, dashboard_summary.budgets (ARCHITECTURE.md §16).
-- Szabály (CONTRACT_CHANGES): a számla a lejárati hónapjához tartozik; spent = kifizetett számlák + gyors kiadások, committed = még ki nem fizetett számlák.

create or replace function public.budget_status(p_month date default null)
returns table (budget_id uuid, category_id uuid, monthly_limit numeric, spent numeric, committed numeric,
               "left" numeric, state text, forecast numeric, suggested_limit numeric)
language plpgsql stable set search_path = '' as $$
declare ms date; me date; today date; dim int; elapsed int; base text; is_current boolean;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  today := public.user_today();
  ms := public.month_start(coalesce(p_month, today));
  me := (ms + interval '1 month')::date - 1;
  dim := (me - ms) + 1;
  is_current := today between ms and me;
  elapsed := case when is_current then (today - ms) + 1 end;
  select base_currency into base from public.profiles where id = auth.uid();

  return query
  with b as (
    select bd.id, bd.category_id, public.fx_convert(bd.monthly_limit, bd.currency, base, today) as lim
      from public.budgets bd where bd.user_id = auth.uid()),
  cur as (
    select i.category_id,
           coalesce(sum(i.amount_base) filter (where i.status = 'paid'), 0)     as spent,
           coalesce(sum(i.amount_base) filter (where i.status = 'upcoming'), 0) as committed,
           coalesce(sum(i.amount_base) filter (where i.kind = 'expense'), 0)    as exp_spent
      from public.v_items i
     where i.user_id = auth.uid() and i.status <> 'skipped' and i.on_date between ms and me
     group by i.category_id),
  prev as (
    select i.category_id, coalesce(sum(i.amount_base), 0) / 3.0 as avg3
      from public.v_items i
     where i.user_id = auth.uid() and i.status <> 'skipped'
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

-- javasolt keret azoknak a kategóriáknak is, amelyeknek még nincs kerete (a „+ Keret" ajánlatához)
create or replace function public.budget_suggestions(p_month date default null)
returns table (category_id uuid, suggested_limit numeric)
language sql stable set search_path = '' as $$
  with base as (select base_currency as cur from public.profiles where id = auth.uid()),
  m as (select public.month_start(coalesce(p_month, public.user_today())) as ms),
  prev as (
    select i.category_id, sum(i.amount_base) / 3.0 as avg3
      from public.v_items i, m
     where i.user_id = auth.uid() and i.status <> 'skipped' and i.category_id is not null
       and i.on_date >= (m.ms - interval '3 months')::date and i.on_date < m.ms
     group by i.category_id)
  select prev.category_id,
         (ceil(prev.avg3 / case when base.cur = 'HUF' then 1000 else 10 end) * case when base.cur = 'HUF' then 1000 else 10 end)::numeric
    from prev, base
   where prev.avg3 > 0 and not exists (select 1 from public.budgets b where b.user_id = auth.uid() and b.category_id = prev.category_id)
   order by prev.avg3 desc
$$;

-- megtakarítási célok: összegyűlt, %, havi szükséges összeg
create or replace view public.savings_goals_progress with (security_invoker = true) as
select g.id, g.user_id, g.name, g.target_amount, g.currency, g.target_date, g.icon, g.color_slot, g.archived_at, g.created_at,
       coalesce(s.saved, 0) as saved,
       round(coalesce(s.saved, 0) / g.target_amount * 100, 2) as pct,
       (coalesce(s.saved, 0) >= g.target_amount) as reached,
       case when g.target_date is null then null
            else greatest(1, ceil((g.target_date - public.user_today()) / 30.4375))::int end as months_left,
       case when g.target_date is null then null
            else round(greatest(0, g.target_amount - coalesce(s.saved, 0))
                       / greatest(1, ceil((g.target_date - public.user_today()) / 30.4375)), 2) end as needed_per_month
  from public.savings_goals g
  left join lateral (select sum(c.amount) as saved from public.goal_contributions c where c.goal_id = g.id) s on true;

-- dashboard_summary: a budgets szekció kitöltve (a 3 legnagyobb kihasználtságú keret)
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
    'budgets', coalesce((
        select jsonb_agg(jsonb_build_object('category_id', t.category_id, 'monthly_limit', t.monthly_limit,
                                            'spent', t.spent, 'committed', t.committed, 'state', t.state))
          from (select * from public.budget_status(ms) limit 3) t), '[]'::jsonb),
    'tip', null
  );
end $$;

-- ───────── jogosultságok ─────────
revoke all on public.savings_goals_progress from anon;
grant select on public.savings_goals_progress to authenticated;
revoke execute on function public.budget_status(date), public.budget_suggestions(date), public.dashboard_summary(date) from public, anon;
grant execute on function public.budget_status(date), public.budget_suggestions(date), public.dashboard_summary(date) to authenticated;

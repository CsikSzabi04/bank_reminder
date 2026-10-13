-- A-31 (B kérésére): az Emlékeztetők lista- és részletoldalhoz. Mindkettő a hívó RLS-ével fut (security invoker).

-- Lista: minden emlékeztető + a következő esedékesség, az utolsó kifizetés napja és a havi egyenérték alap-pénznemben.
create or replace view public.v_reminders with (security_invoker = true) as
select r.*,
       n.id        as next_occurrence_id,
       n.due_date  as next_due,
       n.amount    as next_amount,
       (n.due_date < (now() at time zone p.timezone)::date) as next_overdue,
       lp.paid_on  as last_paid_on,
       public.monthly_equivalent(r.amount, r.currency, r.recur_unit, r.recur_every, p.base_currency,
                                 (now() at time zone p.timezone)::date) as monthly_base
  from public.reminders r
  join public.profiles p on p.id = r.user_id
  left join lateral (select o.id, o.due_date, o.amount from public.occurrences o
                      where o.reminder_id = r.id and o.status = 'upcoming' order by o.due_date limit 1) n on true
  left join lateral (select o.paid_on from public.occurrences o
                      where o.reminder_id = r.id and o.status = 'paid' order by o.due_date desc limit 1) lp on true;

-- Részletek: az esedékességek előzménye árváltozás-jelzéssel (az előző esedékességhez képest, azonos pénznemnél).
create or replace function public.reminder_history(p_reminder_id uuid, p_limit int default 24)
returns table (occurrence_id uuid, due_date date, status text, amount numeric, currency text, paid_on date, paid_amount numeric,
               prev_amount numeric, change_pct numeric, overdue boolean)
language sql stable set search_path = '' as $$
  select x.id, x.due_date, x.status, x.amount, x.cur, x.paid_on, x.paid_amount, x.prev_amount, x.change_pct,
         (x.status = 'upcoming' and x.due_date < public.user_today())
    from (select o.id, o.due_date, o.status, o.amount, o.currency::text as cur, o.paid_on, o.paid_amount,
                 lag(o.amount) over w as prev_amount,
                 case when lag(o.amount) over w > 0 and lag(o.currency) over w = o.currency
                      then round((o.amount - lag(o.amount) over w) / lag(o.amount) over w * 100, 1) end as change_pct
            from public.occurrences o
           where o.reminder_id = p_reminder_id and o.user_id = auth.uid()
          window w as (order by o.due_date)) x
   order by x.due_date desc
   limit least(greatest(coalesce(p_limit, 24), 1), 120)
$$;

revoke all on public.v_reminders from anon;
grant select on public.v_reminders to authenticated;
revoke execute on function public.reminder_history(uuid, int) from public, anon;
grant  execute on function public.reminder_history(uuid, int) to authenticated;

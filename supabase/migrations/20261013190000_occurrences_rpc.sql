-- A-07: ismétlődés + esedékesség-generálás + kifizetés-RPC-k + v_occurrences (ARCHITECTURE.md §8.4, §8.5, §21.2).
-- A snooze_occurrence + értesítési sor az A-12 migrációban érkezik (a teljes sor-építővel együtt).

-- ───────── árfolyam-átváltás (EUR-keresztárfolyam; hiányzó adat → NULL, nem 0) ─────────
create or replace function public.fx_convert(p_amount numeric, p_from text, p_to text, p_on date)
returns numeric language sql stable set search_path = '' as $$
  select case
    when p_amount is null then null
    when p_from = p_to then p_amount
    else p_amount
      * coalesce((select per_eur from public.fx_rates where currency = p_to   and as_of <= p_on order by as_of desc limit 1), case when p_to   = 'EUR' then 1 end)
      / nullif(coalesce((select per_eur from public.fx_rates where currency = p_from and as_of <= p_on order by as_of desc limit 1), case when p_from = 'EUR' then 1 end), 0)
  end
$$;

-- ───────── ismétlődés: a dátumok egyetlen megvalósítása ─────────
create or replace function public.occurrence_dates(
  p_unit text, p_every int, p_start date, p_month_end boolean,
  p_from date, p_to date, p_end date default null)
returns setof date language plpgsql immutable set search_path = '' as $$
declare
  lim date := least(p_to, coalesce(p_end, p_to));
  n int; step int; d date; guard int := 0;
  anchor_day int; start_idx int; from_idx int; tot int; base date; last_day int; dom int;
begin
  if p_start is null or p_from is null or lim is null or lim < p_start or lim < p_from then return; end if;
  if p_unit is null then
    if p_start between p_from and lim then return next p_start; end if;
    return;
  end if;
  if p_every is null or p_every < 1 then raise exception 'recur_every must be >= 1'; end if;

  if p_unit in ('day', 'week') then
    step := p_every * case p_unit when 'week' then 7 else 1 end;
    n := greatest(0, (p_from - p_start) / step);
    loop
      d := p_start + n * step;
      exit when d > lim;
      if d >= p_from then return next d; end if;
      n := n + 1; guard := guard + 1; exit when guard > 20000;
    end loop;
  elsif p_unit in ('month', 'year') then
    step := p_every * case p_unit when 'year' then 12 else 1 end;
    anchor_day := extract(day from p_start)::int;
    start_idx := extract(year from p_start)::int * 12 + extract(month from p_start)::int - 1;
    from_idx  := extract(year from p_from)::int  * 12 + extract(month from p_from)::int  - 1;
    n := greatest(0, (from_idx - start_idx) / step - 1);
    loop
      tot := start_idx + n * step;
      base := make_date(tot / 12, tot % 12 + 1, 1);
      last_day := extract(day from ((base + interval '1 month')::date - 1))::int;
      dom := case when p_month_end then last_day else least(anchor_day, last_day) end;
      d := base + (dom - 1);
      exit when d > lim;
      if d >= p_start and d >= p_from then return next d; end if;
      n := n + 1; guard := guard + 1; exit when guard > 5000;
    end loop;
  else
    raise exception 'unknown recur_unit %', p_unit;
  end if;
end $$;

-- előnézet az űrlaphoz („Következő: nov. 10., dec. 10., …")
create or replace function public.preview_dates(
  p_unit text, p_every int, p_start date, p_month_end boolean default false, p_count int default 4)
returns setof date language plpgsql immutable set search_path = '' as $$
declare cnt int := least(greatest(coalesce(p_count, 4), 1), 24); horizon date;
begin
  if p_start is null then return; end if;
  horizon := p_start + (cnt * greatest(coalesce(p_every, 1), 1) *
              case p_unit when 'day' then 1 when 'week' then 7 when 'month' then 31 when 'year' then 366 else 1 end);
  return query select d from public.occurrence_dates(p_unit, coalesce(p_every, 1), p_start, coalesce(p_month_end, false), p_start, horizon) d limit cnt;
end $$;

-- ───────── esedékességek generálása / szinkronizálása ─────────
create or replace function public.ensure_occurrences(
  p_reminder_id uuid default null, p_horizon_days int default 120, p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare r record; today date; hz date; added int := 0; cnt int;
begin
  for r in
    select rm.*, p.timezone as tz
      from public.reminders rm join public.profiles p on p.id = rm.user_id
     where p_reminder_id is null or rm.id = p_reminder_id
  loop
    today := (p_now at time zone r.tz)::date;
    hz := today + p_horizon_days;

    -- a már nem illeszkedő, jövőbeli, nem kifizetett sorok törlése (a paid/skipped múlt érintetlen)
    delete from public.occurrences o
     where o.reminder_id = r.id and o.status = 'upcoming' and o.due_date between today and hz
       and (not r.is_active or o.due_date not in (
             select d from public.occurrence_dates(r.recur_unit, r.recur_every::int, r.start_date, r.month_end, today, hz, r.end_date) d));

    if r.is_active then
      insert into public.occurrences (reminder_id, user_id, due_date, amount, currency)
      select r.id, r.user_id, d, r.amount, r.currency
        from public.occurrence_dates(r.recur_unit, r.recur_every::int, r.start_date, r.month_end, today, hz, r.end_date) d
      on conflict (reminder_id, due_date) do nothing;
      get diagnostics cnt = row_count; added := added + cnt;

      -- összeg-módosítás: csak a jövőbeli upcoming sorok (a múlt az árelőzmény)
      update public.occurrences set amount = r.amount, currency = r.currency
       where reminder_id = r.id and status = 'upcoming' and due_date >= today
         and (amount is distinct from r.amount or currency is distinct from r.currency);
    end if;
  end loop;
  return added;
end $$;

create or replace function public.ensure_occurrences_all(p_now timestamptz default now())
returns int language sql security definer set search_path = '' as $$
  select public.ensure_occurrences(null, 120, p_now)
$$;

-- csoportos beszedés: esedékességkor (vagy utána) automatikusan „kifizetett"
create or replace function public.process_auto_paid(p_now timestamptz default now())
returns int language plpgsql security definer set search_path = '' as $$
declare cnt int;
begin
  update public.occurrences o
     set status = 'paid', paid_on = o.due_date, paid_at = p_now
    from public.reminders r join public.profiles p on p.id = r.user_id
   where o.reminder_id = r.id and r.auto_paid and o.status = 'upcoming'
     and o.due_date <= (p_now at time zone p.timezone)::date;
  get diagnostics cnt = row_count;
  update public.notifications n set status = 'cancelled'
   where n.status in ('pending', 'failed')
     and n.occurrence_id in (select id from public.occurrences where status = 'paid' and paid_at = p_now);
  return cnt;
end $$;

-- reminder írása után: esedékességek szinkronja
create or replace function public.reminders_after_write() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.ensure_occurrences(new.id);
  return null;
end $$;
create trigger reminders_sync after insert or update on public.reminders
  for each row execute function public.reminders_after_write();

-- ───────── kifizetés-RPC-k (a kliens csak ezeken át módosíthatja az occurrences-t) ─────────
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
     set status = 'paid', paid_at = now(), paid_on = coalesce(p_paid_on, today),
         paid_amount = p_paid_amount, snoozed_until = null
   where id = o.id returning * into o;
  update public.notifications set status = 'cancelled'
   where occurrence_id = o.id and status in ('pending', 'failed');
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
  return o;   -- az értesítések újraépítését az A-12 bővíti (rebuild_notification_queue)
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
  update public.notifications set status = 'cancelled'
   where occurrence_id = o.id and status in ('pending', 'failed');
  return o;
end $$;

-- ───────── olvasó nézet a UI-nak ─────────
create or replace view public.v_occurrences with (security_invoker = true) as
select o.id, o.reminder_id, o.user_id, o.due_date, o.amount, o.currency, o.status, o.paid_on, o.paid_amount, o.paid_at,
       o.snoozed_until, o.created_at,
       r.name as reminder_name, r.category_id, r.service_slug, r.is_subscription,
       public.fx_convert(coalesce(o.paid_amount, o.amount), o.currency, p.base_currency,
                         coalesce(o.paid_on, o.due_date)) as amount_base,
       (o.status = 'upcoming' and o.due_date < (now() at time zone p.timezone)::date) as overdue
  from public.occurrences o
  join public.reminders r on r.id = o.reminder_id
  join public.profiles  p on p.id = o.user_id;

-- ───────── jogosultságok ─────────
revoke execute on function public.ensure_occurrences(uuid, int, timestamptz), public.ensure_occurrences_all(timestamptz),
  public.process_auto_paid(timestamptz), public.reminders_after_write() from public, anon, authenticated;
grant  execute on function public.ensure_occurrences(uuid, int, timestamptz), public.ensure_occurrences_all(timestamptz),
  public.process_auto_paid(timestamptz) to service_role;

revoke execute on function public.mark_paid(uuid, numeric, date), public.mark_unpaid(uuid), public.skip_occurrence(uuid) from public, anon;
grant  execute on function public.mark_paid(uuid, numeric, date), public.mark_unpaid(uuid), public.skip_occurrence(uuid) to authenticated;

revoke execute on function public.preview_dates(text, int, date, boolean, int), public.occurrence_dates(text, int, date, boolean, date, date, date),
  public.fx_convert(numeric, text, text, date) from public, anon;
grant  execute on function public.preview_dates(text, int, date, boolean, int), public.occurrence_dates(text, int, date, boolean, date, date, date),
  public.fx_convert(numeric, text, text, date) to authenticated;

revoke all on public.v_occurrences from anon;
grant select on public.v_occurrences to authenticated;

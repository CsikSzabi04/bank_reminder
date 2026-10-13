-- A-30: minta-adatok a SAJÁT fiókba (onboarding "Minta adatok" + fejlesztés). Nem hoz létre felhasználót; az `is_demo` jelöli, így egy kattintással törölhető.
-- Az összegek ILLUSZTRÁCIÓK (nem állítanak semmit a szolgáltatók valós áráról) — a UI "Minta adat" jelzéssel mutatja.
alter table public.reminders add column if not exists is_demo boolean not null default false;

create or replace function public.load_demo_data() returns int
language plpgsql security definer set search_path = '' as $$
declare u uuid := auth.uid(); tz text; today date; ms date; d record; rid uuid; cat uuid; m int; due date; n int := 0; dim int;
begin
  if u is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if exists (select 1 from public.reminders where user_id = u) then return 0; end if;     -- csak üres fióknál
  select timezone into tz from public.profiles where id = u;
  today := (now() at time zone coalesce(tz, 'UTC'))::date; ms := public.month_start(today);

  for d in select * from (values
      ('Netflix',          2990,   'streaming', 'netflix',        5,  'month', true),
      ('HBO Max',          2490,   'streaming', 'hbo-max',        12, 'month', true),
      ('Prime Video',      1990,   'streaming', 'prime-video',    19, 'month', true),
      ('Spotify',          1790,   'music',     'spotify',        8,  'month', true),
      ('Áram',             14500,  'utilities', null,             15, 'month', false),
      ('Gáz',              9800,   'utilities', null,             20, 'month', false),
      ('Internet',         6990,   'internet',  'digi',           3,  'month', false),
      ('Mobil',            5490,   'mobile',    'magyar-telekom', 10, 'month', false),
      ('Albérlet',         120000, 'rent',      null,             1,  'month', false),
      ('Lakásbiztosítás',  38400,  'insurance', null,             25, 'year',  false),
      ('Edzőterem',        8900,   'sports',    null,             7,  'month', true)
    ) t(name, amount, ckey, slug, dom, unit, sub) loop
    select id into cat from public.categories where key = d.ckey and user_id is null;
    insert into public.reminders (user_id, name, amount, category_id, service_slug, is_subscription, recur_unit, start_date, note, is_demo)
    values (u, d.name, d.amount, cat, d.slug, d.sub, d.unit,
            case when d.unit = 'year' then (ms + interval '2 months')::date + (d.dom - 1) else ms + (d.dom - 1) end, 'Minta adat', true)
    returning id into rid;
    -- előzmény: az elmúlt 3 hónap kifizetve (havi tételeknél), hogy az analitika/keretek legyen mit mutassanak
    if d.unit = 'month' then
      for m in 1..3 loop
        due := (ms - make_interval(months => m))::date;
        dim := extract(day from ((due + interval '1 month')::date - 1))::int;
        due := due + (least(d.dom, dim) - 1);
        insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at)
        values (rid, u, due, d.amount, 'HUF', 'paid', due, now()) on conflict (reminder_id, due_date) do nothing;
      end loop;
    end if;
    n := n + 1;
  end loop;

  insert into public.expenses (user_id, category_id, amount, spent_on, note)
  select u, (select id from public.categories where key = v.k and user_id is null), v.a, greatest(ms, today - v.o), '[demo]'
    from (values ('groceries', 18500, 2), ('groceries', 12300, 9), ('groceries', 9800, 16), ('eating_out', 7400, 5), ('eating_out', 5200, 12), ('transport', 6500, 6)) v(k, a, o);
  return n;
end $$;

create or replace function public.clear_demo_data() returns int
language plpgsql security definer set search_path = '' as $$
declare n int;
begin
  if auth.uid() is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  delete from public.reminders where user_id = auth.uid() and is_demo;      -- az esedékességek és értesítések kaszkáddal törlődnek
  get diagnostics n = row_count;
  delete from public.expenses where user_id = auth.uid() and note = '[demo]';
  return n;
end $$;

revoke execute on function public.load_demo_data(), public.clear_demo_data() from public, anon;
grant  execute on function public.load_demo_data(), public.clear_demo_data() to authenticated;

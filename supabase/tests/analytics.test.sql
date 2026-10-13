-- A-10: analitika-RPC-k kézzel ellenőrzött fixture-ön. A hónapok a "ma"-hoz képest relatívak (M = előző hónap, P = az azelőtti),
-- így a teszt nem függ a futtatás napjától. Futtatás: tranzakcióban, ROLLBACK-kel.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  tdy date := (now() at time zone 'Europe/Budapest')::date;
  M date; P date; C date;
  rNet uuid; rRent uuid; rSpo uuid; rNo uuid; rGym uuid;
  cStream uuid; cRent uuid; cGro uuid; cSport uuid;
  r record; j jsonb; n int; v numeric; ok boolean;
begin
  C := public.month_start(tdy); M := (C - interval '1 month')::date; P := (M - interval '1 month')::date;
  select id into cStream from public.categories where key = 'streaming' and user_id is null;
  select id into cRent   from public.categories where key = 'rent' and user_id is null;
  select id into cGro    from public.categories where key = 'groceries' and user_id is null;
  select id into cSport  from public.categories where key = 'sports' and user_id is null;
  assert cStream is not null and cRent is not null and cGro is not null, 'a rendszer-kategóriák hiányoznak (seed)';

  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (uB, 'authenticated', 'authenticated', 'b@example.test', '{}');
  insert into public.fx_rates (as_of, currency, per_eur) values (P, 'HUF', 360), (P, 'USD', 1.2);   -- 10 USD = 3000 HUF

  -- emlékeztetők: az egyszeri (régi) nem generál sort; a havi/éves igen (csak a jövőt érinti, a tesztelt hónapokat nem)
  insert into public.reminders (user_id, name, amount, currency, category_id, is_subscription, recur_unit, start_date) values
    (uA, 'Netflix', 2300,  'HUF', cStream, true,  'month', M + 9)  returning id into rNet;
  insert into public.reminders (user_id, name, amount, currency, category_id, is_subscription, recur_unit, start_date) values
    (uA, 'Albérlet', 100000, 'HUF', cRent, false, 'month', M)      returning id into rRent;
  insert into public.reminders (user_id, name, amount, currency, category_id, is_subscription, recur_unit, start_date) values
    (uA, 'Spotify', 10, 'USD', cStream, true, 'month', M + 19)     returning id into rSpo;
  insert into public.reminders (user_id, name, amount, currency, start_date) values
    (uA, 'Névtelen', 777, 'HUF', date '2020-01-01')                returning id into rNo;
  insert into public.reminders (user_id, name, amount, currency, category_id, is_subscription, recur_unit, start_date) values
    (uA, 'Edzőterem', 60000, 'HUF', cSport, true, 'year', M + 4)   returning id into rGym;
  delete from public.occurrences where reminder_id in (rNet, rRent, rSpo, rNo, rGym);

  -- P hónap: Netflix 10-én (paid), Albérlet 1-jén (paid)
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at) values
    (rNet,  uA, P + 9, 2300,   'HUF', 'paid', P + 9, now()),
    (rRent, uA, P,     100000, 'HUF', 'paid', P,     now());
  -- M hónap: Netflix 10-én (paid), Albérlet 1-jén (paid), Spotify 20-án (upcoming, USD), Névtelen (skipped), gyors kiadás 15-én
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at) values
    (rNet,  uA, M + 9,  2300,   'HUF', 'paid', M + 9, now()),
    (rRent, uA, M,      100000, 'HUF', 'paid', M,     now());
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status) values
    (rSpo, uA, M + 19, 10, 'USD', 'upcoming'),
    (rNo,  uA, M + 5,  777, 'HUF', 'skipped');
  insert into public.expenses (user_id, category_id, amount, spent_on, note) values (uA, cGro, 5000, M + 14, 'Bevásárlás');
  -- B-nek is van adata (nem szivároghat át)
  insert into public.expenses (user_id, amount, spent_on) values (uB, 999999, M + 1);

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- C1
  select count(*) into n from public.analytics_by_group(M, C - 1); assert n = 3, 'C1 csoportok száma: ' || n;
  select total into v from public.analytics_by_group(M, C - 1) where group_slot = 2; assert v = 100000, 'C1 slot2: ' || v;
  select total into v from public.analytics_by_group(M, C - 1) where group_slot = 1; assert v = 5300, 'C1 slot1 (2300 + 10 USD=3000): ' || v;
  select remaining into v from public.analytics_by_group(M, C - 1) where group_slot = 1; assert v = 3000, 'C1 slot1 remaining: ' || v;
  select total into v from public.analytics_by_group(M, C - 1) where group_slot = 6; assert v = 5000, 'C1 slot6 (gyors kiadás): ' || v;
  select count(*) into n from public.analytics_by_group(M, C - 1) where group_slot = 9; assert n = 0, 'a skipped tétel számít';

  -- dashboard_summary(M)
  j := public.dashboard_summary(M);
  assert (j #>> '{hero,total}')::numeric = 110300, 'hero.total: ' || (j #>> '{hero,total}');
  assert (j #>> '{hero,paid}')::numeric = 107300 and (j #>> '{hero,remaining}')::numeric = 3000, 'hero paid/remaining';
  assert (j #>> '{hero,prev_total}')::numeric = 102300, 'hero.prev_total';
  assert (j #>> '{hero,delta_pct}')::numeric = 7.8, 'delta_pct: ' || (j #>> '{hero,delta_pct}');
  assert (j #>> '{hero,unconverted}')::int = 0, 'unconverted';
  assert jsonb_array_length(j -> 'groups') = 3, 'groups';
  assert jsonb_array_length(j -> 'upcoming') between 1 and 5, 'upcoming hossza';
  assert (j #>> '{subscriptions,count}')::int = 3, 'subs count';
  assert (j #>> '{subscriptions,monthly_total}')::numeric = 10300, 'subs monthly: ' || (j #>> '{subscriptions,monthly_total}');
  assert (j #>> '{subscriptions,yearly_total}')::numeric = 123600, 'subs yearly';
  assert j ->> 'base_currency' = 'HUF' and j ->> 'month' = M::text, 'month/base_currency';

  -- hiányzó árfolyam → unconverted jelzés, nem 0-ként számol
  reset role;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status) values (rSpo, uA, M + 25, 8, 'CHF', 'upcoming');
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.dashboard_summary(M);
  assert (j #>> '{hero,unconverted}')::int = 1, 'unconverted a CHF-nél: ' || (j #>> '{hero,unconverted}');
  assert (j #>> '{hero,total}')::numeric = 110300, 'a konvertálhatatlan tétel belekerült az összegbe';

  -- C2: trend (P, M, C)
  select paid into v from public.analytics_monthly_trend(3) where month = P; assert v = 102300, 'trend P paid: ' || v;
  select paid into v from public.analytics_monthly_trend(3) where month = M; assert v = 107300, 'trend M paid: ' || v;
  select remaining into v from public.analytics_monthly_trend(3) where month = M; assert v = 3000, 'trend M remaining: ' || v;
  select count(*) into n from public.analytics_monthly_trend(3); assert n = 3, 'trend sorok: ' || n;

  -- C3: kumulatív
  select cum_this into v from public.analytics_cumulative(M) where day = M;      assert v = 100000, 'cum d1: ' || v;
  select cum_this into v from public.analytics_cumulative(M) where day = M + 9;  assert v = 102300, 'cum d10: ' || v;
  select cum_this into v from public.analytics_cumulative(M) where day = M + 14; assert v = 107300, 'cum d15: ' || v;
  select cum_this into v from public.analytics_cumulative(M) where day = M + 19; assert v = 110300, 'cum d20: ' || v;
  select cum_prev into v from public.analytics_cumulative(M) where day = M + 9;  assert v = 102300, 'cum_prev d10: ' || v;
  select cum_prev into v from public.analytics_cumulative(M) where day = M;      assert v = 100000, 'cum_prev d1: ' || v;
  select cum_prev into v from public.analytics_cumulative(date '2026-10-01') where day = date '2026-10-31';
  assert v is null, 'október 31. előző havi párja nem NULL';
  select count(*) into n from public.analytics_cumulative(date '2026-10-01'); assert n = 31, 'okt. napjai';

  -- C4 top (számlák; a skipped és a gyors kiadás nincs benne)
  select count(*) into n from public.analytics_top(M, C - 1, 5); assert n = 3, 'top sorok: ' || n;
  select name into r from public.analytics_top(M, C - 1, 5) limit 1; assert r.name = 'Albérlet', 'top 1: ' || r.name;

  -- C5 / C6 / C7
  select total into v from public.analytics_group_trend(3) where month = M and group_slot = 2; assert v = 100000, 'group_trend: ' || v;
  select count(*) into n from public.upcoming_days(30); assert n = 30, 'upcoming_days: ' || n;
  select count(*) into n from public.analytics_subscriptions(); assert n = 3, 'subs sorok: ' || n;
  select share_pct into v from public.analytics_subscriptions() where name = 'Netflix'; assert round(v, 1) = 22.3, 'share: ' || v;
  select monthly into v from public.analytics_subscriptions() where name = 'Edzőterem'; assert v = 5000, 'éves → havi: ' || v;
  select monthly into v from public.analytics_subscriptions() where name = 'Spotify'; assert v = 3000, 'USD → HUF havi: ' || v;

  -- B nem lát A-ból semmit, és A adataiba nem lát bele
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.analytics_by_group(P, C + 31); assert n = 1, 'B csoportjai: ' || n;       -- csak a saját 999999
  select total into v from public.analytics_by_group(P, C + 31); assert v = 999999, 'B összege: ' || v;
  select count(*) into n from public.analytics_subscriptions(); assert n = 0, 'B látja A előfizetéseit';
  j := public.dashboard_summary(M); assert (j #>> '{hero,total}')::numeric = 999999, 'B hero: ' || (j #>> '{hero,total}');
  reset role;

  -- anon / jogosultság
  set local role anon;
  ok := false; begin perform public.dashboard_summary(M); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon hívhatja a dashboard_summary-t';
  reset role;

  raise notice 'A-10 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

-- A-11: költségkeretek (ok/watch/over), előrejelzés, javasolt keret, megtakarítási célok. Tranzakcióban, ROLLBACK-kel.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  tdy date := (now() at time zone 'Europe/Budapest')::date;
  C date; M date; cGro uuid; cTra uuid; cShop uuid; cFun uuid; rTra uuid; g uuid; row_ record; n int; v numeric; j jsonb;
begin
  C := public.month_start(tdy); M := (C - interval '1 month')::date;
  select id into cGro from public.categories where key = 'groceries' and user_id is null;
  select id into cTra from public.categories where key = 'transport' and user_id is null;
  select id into cShop from public.categories where key = 'shopping' and user_id is null;
  select id into cFun from public.categories where key = 'fun' and user_id is null;
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (uB, 'authenticated', 'authenticated', 'b@example.test', '{}');

  -- keretek (A)
  insert into public.budgets (user_id, category_id, monthly_limit) values (uA, cGro, 10000), (uA, cTra, 10000), (uA, cShop, 1000), (uA, cFun, 10000);
  -- M hónap: Élelmiszer 8500 (watch: ≥ 80%), Közlekedés: kifizetett 2000 + még fizetendő 9000 → spent+committed > limit → watch, Ruházat 1500 > 1000 → over, Szórakozás 100 → ok
  insert into public.expenses (user_id, category_id, amount, spent_on) values
    (uA, cGro, 8500, M + 3), (uA, cShop, 1500, M + 4), (uA, cFun, 100, M + 5), (uB, cGro, 99999, M + 3);
  insert into public.reminders (user_id, name, amount, category_id, start_date) values (uA, 'Bérlet', 1, cTra, date '2020-01-01') returning id into rTra;
  delete from public.occurrences where reminder_id = rTra;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at) values (rTra, uA, M + 1, 2000, 'HUF', 'paid', M + 1, now());
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status) values (rTra, uA, M + 10, 9000, 'HUF', 'upcoming');
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status) values (rTra, uA, M + 11, 5000, 'HUF', 'skipped');

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select * into row_ from public.budget_status(M) where category_id = cGro;
  assert row_.spent = 8500 and row_.committed = 0 and row_."left" = 1500 and row_.state = 'watch', 'élelmiszer: ' || row_::text;
  assert row_.forecast is null, 'múlt hónapra nincs előrejelzés';
  select * into row_ from public.budget_status(M) where category_id = cTra;
  assert row_.spent = 2000 and row_.committed = 9000 and row_.state = 'watch', 'közlekedés: ' || row_::text;       -- a skipped nem számít
  select * into row_ from public.budget_status(M) where category_id = cShop;
  assert row_.spent = 1500 and row_."left" = -500 and row_.state = 'over', 'ruházat: ' || row_::text;
  select * into row_ from public.budget_status(M) where category_id = cFun;
  assert row_.state = 'ok', 'szórakozás: ' || row_::text;
  select count(*) into n from public.budget_status(M); assert n = 4, 'keretek száma: ' || n;
  select category_id into row_ from public.budget_status(M) limit 1; assert row_.category_id = cShop, 'a legkihasználtabb keret nem elöl';

  -- B nem lát A kereteiből semmit
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.budget_status(M); assert n = 0, 'B látja A kereteit';
  reset role;

  -- aktuális hónap: előrejelzés a változó (gyors) kiadásokra
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  insert into public.expenses (user_id, category_id, amount, spent_on) values (uA, cGro, 3000, tdy);
  set local role authenticated;
  select * into row_ from public.budget_status(C) where category_id = cGro;
  assert row_.forecast is not null and row_.forecast >= 3000, 'előrejelzés: ' || coalesce(row_.forecast::text, 'NULL');
  reset role;

  -- javasolt keret: az előző 3 hónap átlaga, 1000-re felfelé kerekítve (HUF)
  delete from public.expenses where user_id = uA;
  insert into public.expenses (user_id, category_id, amount, spent_on) values
    (uA, cGro, 2000, (C - interval '1 month')::date + 2), (uA, cGro, 3000, (C - interval '2 month')::date + 2), (uA, cGro, 2500, (C - interval '3 month')::date + 2),
    (uA, cShop, 800, (C - interval '1 month')::date + 2);
  set local role authenticated;
  select suggested_limit into v from public.budget_status(C) where category_id = cGro; assert v = 3000, 'javasolt keret: ' || coalesce(v::text, 'NULL');   -- (2000+3000+2500)/3 = 2500 → 3000
  select count(*) into n from public.budget_suggestions(C); assert n = 0, 'minden kategóriának van kerete, nincs javaslat: ' || n;
  reset role;
  delete from public.budgets where user_id = uA and category_id = cGro;
  set local role authenticated;
  select suggested_limit into v from public.budget_suggestions(C) where category_id = cGro; assert v = 3000, 'budget_suggestions: ' || coalesce(v::text, 'NULL');
  reset role;

  -- megtakarítási célok
  insert into public.savings_goals (user_id, name, target_amount, target_date) values (uA, 'Nyaralás', 120000, tdy + 180) returning id into g;
  insert into public.goal_contributions (goal_id, user_id, amount) values (g, uA, 50000), (g, uA, 10000), (g, uA, -5000);
  insert into public.savings_goals (user_id, name, target_amount) values (uA, 'Vészhelyzeti alap', 1000);
  set local role authenticated;
  select * into row_ from public.savings_goals_progress where id = g;
  assert row_.saved = 55000 and row_.pct = 45.83 and not row_.reached, 'cél haladása: ' || row_::text;
  assert row_.months_left = 6 and row_.needed_per_month = 10833.33, 'havi szükséges: ' || row_.months_left || ' / ' || row_.needed_per_month;
  select needed_per_month into v from public.savings_goals_progress where name = 'Vészhelyzeti alap'; assert v is null, 'határidő nélkül nincs havi összeg';
  reset role;
  insert into public.goal_contributions (goal_id, user_id, amount) select id, uA, 1000 from public.savings_goals where name = 'Vészhelyzeti alap';
  set local role authenticated;
  select reached into row_ from public.savings_goals_progress where name = 'Vészhelyzeti alap'; assert row_.reached, 'elért cél nem jelölt';

  -- dashboard_summary.budgets: legfeljebb 3
  j := public.dashboard_summary(M);
  assert jsonb_array_length(j -> 'budgets') <= 3, 'budgets hossza';
  reset role;

  raise notice 'A-11 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

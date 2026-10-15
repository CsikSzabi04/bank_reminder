-- A-45: keret-riasztás (advanced.md §7). Közvetlen `expenses`-beszúrással (webhook nélkül), a felhasználó nevében. Tranzakcióban, ROLLBACK-kel.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  cat1 uuid; cat6 uuid; cat7 uuid; cat2 uuid; cat3 uuid; cat4 uuid; cat5 uuid; catNo uuid; rem uuid;
  d0 date := (now() at time zone 'UTC')::date;
  mstart date := date_trunc('month', (now() at time zone 'UTC'))::date;
  n int; v text; p jsonb; ok boolean;
begin
  insert into auth.users (id, aud, role, email) values (uA, 'authenticated', 'authenticated', 'a@budget.test'), (uB, 'authenticated', 'authenticated', 'b@budget.test');
  update public.profiles set timezone = 'UTC' where id in (uA, uB);
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Étterem', 'Dining') returning id into cat1;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Mozi', 'Cinema') returning id into cat2;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Sport', 'Sports') returning id into cat3;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Utazás', 'Travel') returning id into cat4;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Ajándék', 'Gifts') returning id into cat5;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Keret nélkül', 'No budget') returning id into catNo;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Egyéb', 'Other') returning id into cat6;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Hobbi', 'Hobby') returning id into cat7;
  insert into public.budgets (user_id, category_id, monthly_limit, currency)
    values (uA, cat1, 15000, 'HUF'), (uA, cat2, 15000, 'HUF'), (uA, cat3, 15000, 'HUF'), (uA, cat4, 15000, 'HUF'), (uA, cat5, 15000, 'HUF'), (uA, cat6, 15000, 'HUF'), (uA, cat7, 15000, 'HUF');

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1) 66% → semmi
  insert into public.expenses (category_id, amount, spent_on) values (cat1, 10000, d0);
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget'; assert n = 0, format('66%%-nál %s riasztás ment', n);

  -- 2) 83% → watch (in_app + push)
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (cat1, 2500, d0);
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'level' = 'watch'; assert n = 1, format('watch in_app: %s (várt 1)', n);
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'push' and payload ->> 'level' = 'watch' and status = 'pending'; assert n = 1, 'a watch push-sor hiányzik/nem pending';

  -- 3) 16 000 / 15 000 → over (a példa): +1 in_app
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (cat1, 3500, d0);
  reset role;
  select payload into p from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'level' = 'over';
  assert p is not null, 'nincs over riasztás';
  assert (p ->> 'spent')::numeric = 16000 and (p ->> 'limit')::numeric = 15000 and (p ->> 'pct')::int = 106 and p ->> 'currency' = 'HUF', 'over payload hibás: ' || p::text;
  assert p ->> 'category_name_hu' = 'Étterem' and p ->> 'category_name_en' = 'Dining', 'kategórianév hibás';
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app'; assert n = 2, format('in_app összesen %s (várt 2: watch + over)', n);

  -- 4) újabb költés ugyanabban a hónapban → nincs új over; más oszlop szerkesztése sem küld
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (cat1, 5000, d0);
  update public.expenses set amount = amount + 1 where category_id = cat1 and amount = 5000;
  update public.expenses set note = 'jegyzet' where category_id = cat1;
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'category_id' = cat1::text; assert n = 2, format('az újabb költés új riasztást küldött: %s', n);
  assert public.check_budget_alert(uA, cat1, null, now()) = 0, 'az ismételt hívás újabb sort hozott létre (dedupe sérült)';

  -- 5) 15 000 / 15 000 pontosan = NEM over (az állapot-szabály: spent > limit), 16 000 az
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (cat2, 15000, d0);
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'level' = 'over' and payload ->> 'category_id' = cat2::text;
  assert n = 0, 'pontosan a keretnél over riasztás ment';
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'level' = 'watch' and payload ->> 'category_id' = cat2::text;
  assert n = 1, 'a 100%-os kihasználtság nem adott watch-ot';

  -- 6) közvetlenül over-be ugrás: csak over (watch nem)
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (cat3, 16000, d0);
  reset role;
  select string_agg(payload ->> 'level', ',') into v from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'category_id' = cat3::text;
  assert v = 'over', 'az egy lépésben túllépés nem pontosan egy over: ' || coalesce(v, 'NULL');

  -- 6b) a túllépés UTÁN a „közel" szint nem küldhető: a kiadás csökkentése watch-állapotba nem ad watch-riasztást
  set local role authenticated;
  update public.expenses set amount = 13000 where category_id = cat3;
  reset role;
  select string_agg(payload ->> 'level', ',') into v from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'category_id' = cat3::text;
  assert v = 'over', 'a túllépés után watch-riasztás ment: ' || coalesce(v, 'NULL');

  -- 6c) a MÓDOSÍTÁS is riaszt: 5 000 → 16 000-re átírva túllépés; a kategória-váltás is
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (cat6, 5000, d0);
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and payload ->> 'category_id' = cat6::text; assert n = 0, 'a 33%%-os tétel riasztott';
  set local role authenticated;
  update public.expenses set amount = 16000 where category_id = cat6;
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'category_id' = cat6::text and payload ->> 'level' = 'over';
  assert n = 1, 'az átírt összeg nem váltott ki riasztást';

  -- 7) keret nélküli és besorolatlan kiadás → nincs riasztás
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (catNo, 99999, d0);
  insert into public.expenses (category_id, amount, spent_on) values (null, 99999, d0);
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and payload ->> 'category_id' = catNo::text; assert n = 0, 'keret nélküli kategória riasztott';
  assert public.check_budget_alert(uA, catNo, null, now()) = 0, 'keret nélküli kategóriára a függvény nem 0-t adott';
  assert public.check_budget_alert(uA, null, null, now()) = 0, 'besorolatlanra a függvény nem 0-t adott';

  -- 7b) a kategória-váltás is riaszt: a keret nélküli kategóriából a keretesbe átsorolt 99 999 Ft túllépés
  set local role authenticated;
  update public.expenses set category_id = cat7 where category_id = catNo;
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'category_id' = cat7::text and payload ->> 'level' = 'over';
  assert n = 1, 'az átsorolás nem váltott ki riasztást';

  -- 8) múltbeli hónap utólagos rögzítése nem riaszt
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (cat4, 16000, (mstart - interval '40 days')::date);
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and payload ->> 'category_id' = cat4::text; assert n = 0, 'a múltbeli hónap utólagos tétele riasztott';

  -- 9) a még ki nem fizetett számla miatti „watch" (committed) nem riaszt, kis valódi költésnél sem
  set local role authenticated;
  insert into public.reminders (name, amount, start_date, category_id) values ('Tornabérlet', 20000, (mstart + interval '1 month' - interval '1 day')::date, cat4) returning id into rem;   -- a hónap utolsó napja: biztosan még nem múlt el
  insert into public.expenses (category_id, amount, spent_on) values (cat4, 1000, d0);
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and payload ->> 'category_id' = cat4::text; assert n = 0, 'a függő számla miatti állapot riasztott (spent csak 1000)';

  -- 10) az ideiglenes (értesítés-eredetű) tétel is beleszámít, a szerver-oldali (service) beszúrás is riaszt
  insert into public.expenses (user_id, category_id, amount, spent_on, source, is_provisional, merchant)
    values (uA, cat5, 16000, d0, 'notification', true, 'Teszt Étterem');
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app' and payload ->> 'category_id' = cat5::text and payload ->> 'level' = 'over';
  assert n = 1, 'az ideiglenes tétel nem váltott ki riasztást';

  -- 11) kapcsolók: budget_alerts = false → nincs; channel_push = false → csak in_app
  update public.profiles set budget_alerts = false where id = uA;
  delete from public.notifications where user_id = uA and kind = 'budget';
  insert into public.expenses (user_id, category_id, amount, spent_on) values (uA, cat1, 1, d0);
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget'; assert n = 0, 'budget_alerts=false mellett is riasztott';
  update public.profiles set budget_alerts = true, channel_push = false where id = uA;
  insert into public.expenses (user_id, category_id, amount, spent_on) values (uA, cat1, 1, d0);
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'push'; assert n = 0, 'channel_push=false mellett push-sor készült';
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and channel = 'in_app'; assert n = 1, 'a push nélküli riasztás in_app sora hiányzik';
  update public.profiles set channel_push = true where id = uA;

  -- 12) következő hónap: újra kezdődik (a függvény közvetlen hívásával, az idő előretekerve)
  insert into public.expenses (user_id, category_id, amount, spent_on) values (uA, cat1, 16000, (mstart + interval '1 month')::date);   -- a trigger ezt (jövő hónap) kihagyja
  n := public.check_budget_alert(uA, cat1, null, (mstart + interval '1 month' + interval '2 days')::timestamptz);
  assert n = 2, format('a következő hónapban %s sor jött létre (várt 2: in_app + push)', n);
  select count(*) into n from public.notifications where user_id = uA and kind = 'budget' and payload ->> 'level' = 'over' and payload ->> 'month' = to_char(mstart + interval '1 month', 'YYYY-MM');
  assert n = 2, 'a következő havi over sorok hiányoznak';

  -- 13) B: nincs keret, nincs riasztás; A riasztásai B-nek nem látszanak
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  insert into public.expenses (category_id, amount, spent_on) values (null, 50000, d0);
  select count(*) into n from public.notifications; assert n = 0, 'B látja A riasztásait / kapott sajátot';
  reset role;

  -- 14) a függvény kliensről nem hívható
  assert not has_function_privilege('authenticated', 'public.check_budget_alert(uuid, uuid, date, timestamptz)', 'execute'), 'a kliens hívhatja a check_budget_alert-et';
  assert not has_function_privilege('authenticated', 'public.expenses_budget_alert()', 'execute'), 'a kliens hívhatja a trigger-függvényt';
  ok := false;
  begin set local role authenticated; perform public.check_budget_alert(uA, cat1);
  exception when insufficient_privilege then ok := true; end;
  reset role;
  assert ok, 'a kliens meghívta a check_budget_alert-et';

  raise notice 'A-45 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

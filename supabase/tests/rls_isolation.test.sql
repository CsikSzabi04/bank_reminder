-- A-14: RLS/jogosultság-teszt (két felhasználó). Futtatás tranzakcióban, ROLLBACK-kel (db-sql --rollback).
-- Bármilyen hiba = a teszt bukik. Nem hagy nyomot az adatbázisban.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  catA uuid; catSys uuid; remA uuid; occA uuid; srcOk text := 'rls-test-src';
  n int; ok boolean; s text; v text;
begin
  -- 0) meta: minden public táblán RLS be van kapcsolva
  select count(*) into n from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  assert n = 0, format('%s public táblán nincs RLS', n);
  -- 0b) minden security definer függvénynek fix search_path-ja van
  select count(*) into n from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.prosecdef
     and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%');
  assert n = 0, format('%s security definer függvénynek nincs search_path-ja', n);

  -- 1) handle_new_user: profil a metaadatból; érvénytelen nyelv → hu
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (uA, 'authenticated', 'authenticated', 'a@example.test', '{"display_name":"Anna","locale":"en"}'),
           (uB, 'authenticated', 'authenticated', 'b@example.test', '{"display_name":"  ","locale":"xx"}');
  select display_name || '/' || locale into v from public.profiles where id = uA;
  assert v = 'Anna/en', 'profil A hibás: ' || coalesce(v, 'NULL');
  select coalesce(display_name, '∅') || '/' || locale into v from public.profiles where id = uB;
  assert v = '∅/hu', 'profil B hibás: ' || coalesce(v, 'NULL');

  -- előkészítés (postgres): rendszer-kategória, hírek
  insert into public.categories (key, name_hu, name_en, color_slot) values ('rls_test_sys', 'T', 'T', 1) returning id into catSys;
  insert into public.news_sources (key, name, feed_url, home_url) values (srcOk, 'T', 'https://x.test/rss', 'https://x.test');
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values
    (srcOk, 'https://x.test/1', 'ok',      'general', now(), now() + interval '1 day'),
    (srcOk, 'https://x.test/2', 'expired', 'general', now() - interval '9 day', now() - interval '1 day');
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at, is_hidden) values
    (srcOk, 'https://x.test/3', 'hidden',  'general', now(), now() + interval '1 day', true);

  -- 2) A bejelentkezik
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;

  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Saját', 'Own') returning id into catA;
  insert into public.reminders (name, amount, start_date, category_id) values ('Netflix', 2300, date '2026-11-10', catSys) returning id into remA;
  select count(*) into n from public.categories where id in (catSys, catA); assert n = 2, 'A nem látja a rendszer/saját kategóriát';
  select count(*) into n from public.profiles; assert n = 1, 'A csak a saját profilját láthatja';
  update public.profiles set display_name = 'Anna2' where id = uA;
  get diagnostics n = row_count; assert n = 1, 'A nem tudja frissíteni a saját profilját';

  -- A: tiltott műveletek (mind hibával kell végződjön)
  foreach s in array array[
    format('update public.profiles set ics_token = ''x'' where id = %L', uA),               -- oszlop-jog
    format('insert into public.profiles (id) values (%L)', gen_random_uuid()),              -- nincs insert jog
    format('delete from public.profiles where id = %L', uA),
    format('insert into public.reminders (user_id, name, amount, start_date) values (%L, ''x'', 1, current_date)', uB),  -- RLS with check
    format('insert into public.categories (user_id, key, name_hu) values (%L, ''hack'', ''x'')', uA),                    -- key tiltott
    format('insert into public.categories (user_id, name_hu) values (%L, ''x'')', uB),
    format('insert into public.push_subscriptions (endpoint, p256dh, auth) values (''https://fcm.googleapis.com/x'', ''a'', ''b'')'),  -- csak RPC
    'insert into public.notifications (user_id, kind, channel, scheduled_for, dedupe_key) values (auth.uid(), ''system'', ''in_app'', now(), ''k'')',
    'insert into public.tips (user_id, code, fingerprint) values (auth.uid(), ''c'', ''f'')',
    'insert into public.fx_rates values (current_date, ''USD'', 1.1)',
    'insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values (''rls-test-src'', ''https://x.test/h'', ''t'', ''general'', now(), now())',
    'select * from public.news_sources',
    'update public.service_catalog set name = ''x''',
    'truncate public.reminders'
  ] loop
    ok := false;
    begin execute s; exception when insufficient_privilege or check_violation then ok := true; end;
    assert ok, 'A-nak TILOS lenne: ' || s;
  end loop;

  -- A: occurrences csak olvasható (a sorokat a reminders-trigger hozza létre) – itt a jog hiányát ellenőrizzük
  ok := false;
  begin execute 'update public.occurrences set status = ''paid''';  exception when insufficient_privilege then ok := true; end;
  assert ok, 'A tudja módosítani az occurrences-t';
  ok := false;
  begin execute 'insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (null, null, current_date, 1, ''HUF'')';
  exception when insufficient_privilege then ok := true; end;
  assert ok, 'A tud occurrences-t beszúrni';

  -- hírek: csak a nem lejárt, nem rejtett
  select count(*) into n from public.news_feed(null, 50) where source_key = srcOk; assert n = 1, format('A híreknél %s sort lát (várt 1)', n);
  ok := false; begin perform count(*) from public.news_items; exception when insufficient_privilege then ok := true; end; assert ok, 'A közvetlenül olvashatja a news_items-t';

  -- 3) postgres: occurrence A-nak, notification, push endpoint ellenőrzés
  reset role;
  select id into occA from public.occurrences where reminder_id = remA order by due_date limit 1;   -- a trigger generálta
  insert into public.notifications (user_id, kind, channel, scheduled_for, dedupe_key, occurrence_id)
    values (uA, 'reminder', 'in_app', now() - interval '1 minute', 'rls-n1', occA),
           (uA, 'reminder', 'push',   now() - interval '1 minute', 'rls-n2', occA),
           (uA, 'reminder', 'in_app', now() + interval '1 day',    'rls-n3', occA);
  ok := false;
  begin insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (uA, 'https://evil.example.com/x', 'a', 'b');
  exception when check_violation then ok := true; end;
  assert ok, 'tiltott push endpoint bekerült (SSRF-védelem)';
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (uA, 'https://web.push.apple.com/abc', 'a', 'b'), (uA, 'https://fcm.googleapis.com/fcm/send/x', 'a', 'b');

  -- 4) A újra: saját occurrence/notification látszik, de csak read_at módosítható
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.occurrences; assert n >= 1, 'A nem látja a saját occurrence-ét';
  select count(*) into n from public.notifications; assert n = 1, format('A %s notificationt lát (várt 1: csak esedékes in_app)', n);
  update public.notifications set read_at = now(); get diagnostics n = row_count; assert n = 1, 'read_at nem frissíthető';
  ok := false;
  begin execute 'update public.notifications set status = ''sent'''; exception when insufficient_privilege then ok := true; end;
  assert ok, 'A módosíthatja a notifications.status-t';
  select count(*) into n from public.push_subscriptions; assert n = 2, 'A nem látja a saját eszközeit';
  ok := false;
  begin execute 'update public.push_subscriptions set label = ''x'''; exception when insufficient_privilege then ok := true; end;
  assert ok, 'A módosíthatja a push_subscriptions-t közvetlenül';
  delete from public.push_subscriptions; get diagnostics n = row_count; assert n = 2, 'A nem törölheti a saját eszközeit';

  -- 5) B: semmit nem láthat/módosíthat A-ból
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  foreach s in array array['reminders','occurrences','notifications','push_subscriptions','expenses','budgets','savings_goals','goal_contributions','tips','news_reports'] loop
    execute format('select count(*) from public.%I', s) into n;
    assert n = 0, format('B látja A %s sorait', s);
  end loop;
  select count(*) into n from public.profiles where id = uA; assert n = 0, 'B látja A profilját';
  select count(*) into n from public.categories where id = catA; assert n = 0, 'B látja A saját kategóriáját';
  select count(*) into n from public.categories where id = catSys; assert n = 1, 'B nem látja a rendszer-kategóriát';
  update public.reminders set name = 'hack'; get diagnostics n = row_count; assert n = 0, 'B módosíthatja A emlékeztetőjét';
  delete from public.reminders;               get diagnostics n = row_count; assert n = 0, 'B törölheti A emlékeztetőjét';
  update public.profiles set display_name = 'hack' where id = uA; get diagnostics n = row_count; assert n = 0, 'B módosíthatja A profilját';
  foreach s in array array[
    format('insert into public.reminders (name, amount, start_date, category_id) values (''x'', 1, current_date, %L)', catA),     -- A kategóriája
    format('insert into public.budgets (category_id, monthly_limit) values (%L, 100)', catA),
    format('insert into public.expenses (amount, category_id) values (5, %L)', catA),
    format('insert into public.goal_contributions (goal_id, amount) values (%L, 5)', gen_random_uuid())
  ] loop
    ok := false;
    begin execute s; exception when insufficient_privilege or check_violation or foreign_key_violation then ok := true; end;
    assert ok, 'B-nek TILOS lenne: ' || s;
  end loop;

  -- 6) anon semmit nem érhet el
  reset role; set local role anon;
  foreach s in array array['profiles','reminders','categories','service_catalog','news_items','notifications','fx_rates'] loop
    ok := false;
    begin execute format('select count(*) from public.%I', s); exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon olvashatja: ' || s;
  end loop;
  reset role;

  raise notice 'RLS-teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

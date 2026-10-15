-- A-41: haladó kör séma + RLS-teszt (két felhasználó). Tranzakcióban, ROLLBACK-kel (db test).
-- Bármilyen hiba = a teszt bukik. Nem hagy nyomot az adatbázisban.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  catA uuid; catB uuid; catSys uuid; tokA uuid; connA uuid; expA uuid; expBank uuid; txA uuid; txB uuid; ruleSys uuid; ruleA uuid;
  n int; ok boolean; s text; v text; b boolean;
  h1 text := repeat('a', 64);
begin
  insert into auth.users (id, aud, role, email) values
    (uA, 'authenticated', 'authenticated', 'a@bank.test'), (uB, 'authenticated', 'authenticated', 'b@bank.test');
  insert into public.categories (key, name_hu, name_en, color_slot) values ('bank_test_sys', 'T', 'T', 1) returning id into catSys;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'Saját', 'Own') returning id into catA;
  insert into public.categories (user_id, name_hu, name_en) values (uB, 'B-é', 'B-s') returning id into catB;

  -- 0) meta: alapértékek, jogosultsági felület
  select bank_sync_allowed::text || '/' || budget_alerts::text into v from public.profiles where id = uA;
  assert v = 'false/true', 'profil-alapértékek hibásak: ' || v;
  assert not has_column_privilege('authenticated', 'public.ingest_tokens', 'token_hash', 'select'), 'a kliens olvashatja a token_hash-t';
  assert not has_column_privilege('authenticated', 'public.bank_connections', 'session_id', 'select'), 'a kliens olvashatja a session_id-t';
  assert not has_table_privilege('authenticated', 'public.bank_connect_states', 'select'), 'a kliens olvashatja a bank_connect_states-t';
  assert not has_column_privilege('authenticated', 'public.profiles', 'bank_sync_allowed', 'update'), 'a kliens írhatja a bank_sync_allowed-et';
  assert has_column_privilege('authenticated', 'public.profiles', 'budget_alerts', 'update'), 'a kliens nem írhatja a budget_alerts-et';
  assert not has_function_privilege('authenticated', 'public.expenses_tombstone()', 'execute'), 'a kliens hívhatja a tombstone-t';
  assert not has_function_privilege('authenticated', 'public.expenses_guard_flags()', 'execute'), 'a kliens hívhatja a flag-őrt';
  select count(*) into n from information_schema.role_table_grants
   where grantee in ('anon', 'authenticated') and table_schema = 'public'
     and table_name in ('ingest_tokens','ingest_events','bank_connections','bank_connect_states','bank_transactions','merchant_rules')
     and privilege_type in ('INSERT','DELETE','TRUNCATE','TRIGGER','REFERENCES') and not (table_name = 'merchant_rules' and grantee = 'authenticated' and privilege_type in ('INSERT','DELETE'));
  assert n = 0, format('felesleges tábla-szintű jog: %s', n);

  -- 1) előkészítés (postgres): A adatai + egy rendszer-szabály
  insert into public.ingest_tokens (user_id, token_hash, prefix, label, allowed_apps) values (uA, h1, 'abcdef', 'tel', array['hu.revolut']) returning id into tokA;
  insert into public.ingest_events (user_id, token_id, app, outcome, raw_text) values
    (uA, tokA, 'hu.revolut', 'unparsed', 'ismeretlen'), (uA, tokA, 'hu.revolut', 'recorded', null);
  insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, accounts, authorized_at, consent_valid_until)
    values (uA, 'Revolut', 'HU', 'sess-1', '[{"uid":"u1","identification_hash":"h","currency":"HUF","iban_last4":"6581"}]', now(), now() + interval '180 days') returning id into connA;
  insert into public.bank_connect_states (state, user_id, expires_at) values (repeat('s', 32), uA, now() + interval '10 minutes');
  insert into public.expenses (user_id, amount, currency, spent_on, category_id) values (uA, 4500, 'HUF', current_date, catSys) returning id into expA;
  insert into public.bank_transactions (user_id, connection_id, source, status, amount, currency, booked_on, merchant, fingerprint, expense_id)
    values (uA, connA, 'bank', 'booked', 4500, 'HUF', current_date, 'Tesco', repeat('1', 32), expA) returning id into txA;
  insert into public.merchant_rules (user_id, match_key, category_id) values (null, 'zzsys', catSys) returning id into ruleSys;   -- zz-kulcs: ne ütközzön az A-42 rendszer-szabályaival
  insert into public.merchant_rules (user_id, match_key, category_id) values (uA, 'zzaldi', catSys);   -- A tartós szabálya: B-nek nem látszhat

  -- 2) kényszerek (postgres)
  foreach s in array array[
    format('insert into public.ingest_events (user_id, outcome, raw_text) values (%L, ''recorded'', ''nyers szöveg nem maradhat'')', uA),
    format('insert into public.ingest_tokens (user_id, token_hash, prefix) values (%L, ''nem-hex'', ''abcdef'')', uA),
    format('insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, authorized_at, consent_valid_until, sync_count_today) values (%L, ''x'', ''HU'', ''s2'', now(), now() + interval ''1 day'', 3)', uA),
    format('insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, authorized_at, consent_valid_until) values (%L, ''x'', ''HU'', ''s3'', now(), now() - interval ''1 day'')', uA),
    format('insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, fingerprint) values (%L, ''bank'', ''booked'', 0, ''HUF'', current_date, repeat(''2'', 32))', uA),
    format('insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, fingerprint) values (%L, ''sms'', ''booked'', 1, ''HUF'', current_date, repeat(''3'', 32))', uA),
    format('insert into public.notifications (user_id, kind, channel, scheduled_for, dedupe_key) values (%L, ''bogus'', ''in_app'', now(), ''bk-bogus'')', uA)
  ] loop
    ok := false;
    begin execute s; exception when check_violation then ok := true; end;
    assert ok, 'check-kényszernek el kellene utasítania: ' || s;
  end loop;
  -- duplikált ujjlenyomat és kétszer párosított tétel
  ok := false;
  begin insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, fingerprint) values (uA, 'bank', 'booked', 1, 'HUF', current_date, repeat('1', 32));
  exception when unique_violation then ok := true; end;
  assert ok, 'azonos (user, fingerprint) kétszer bekerült';
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, fingerprint, matched_with)
    values (uA, 'notification', 'provisional', 4500, 'HUF', current_date, repeat('4', 32), txA) returning id into txB;
  ok := false;
  begin insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, fingerprint, matched_with) values (uA, 'notification', 'provisional', 4500, 'HUF', current_date, repeat('5', 32), txA);
  exception when unique_violation then ok := true; end;
  assert ok, 'egy tételhez két tétel is párosulhat (1:1 sérül)';
  ok := false;
  begin insert into public.merchant_rules (user_id, match_key, category_id) values (null, 'zzsys', catSys);
  exception when unique_violation then ok := true; end;
  assert ok, 'azonos rendszer-szabály kétszer bekerült';
  -- az új értesítés-fajták bekerülnek
  insert into public.notifications (user_id, kind, channel, scheduled_for, dedupe_key) values (uA, 'budget', 'in_app', now(), 'bk-budget'), (uA, 'bank_consent', 'in_app', now(), 'bk-consent');

  -- 3) A bejelentkezik
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.ingest_tokens;       assert n = 1, 'A nem látja a tokenjét';
  select count(*) into n from public.ingest_events;       assert n = 2, 'A nem látja az eseményeit';
  select count(*) into n from public.bank_connections;    assert n = 1, 'A nem látja a kapcsolatát';
  select count(*) into n from public.bank_transactions;   assert n = 2, 'A nem látja a tételeit';
  select count(*) into n from public.merchant_rules where match_key like 'zz%';      assert n = 2, 'A nem látja a rendszer- és a saját szabályát';
  select prefix into v from public.ingest_tokens;         assert v = 'abcdef', 'A prefix nem olvasható';
  select count(*) into n from public.bank_connections where status = 'active' and accounts -> 0 ->> 'iban_last4' = '6581'; assert n = 1, 'a számla-lista nem olvasható';

  foreach s in array array[
    'select token_hash from public.ingest_tokens',                                         -- oszlop-jog
    'select * from public.ingest_tokens',                                                  -- a * a token_hash-t is kérné
    'select session_id from public.bank_connections',
    'select * from public.bank_connect_states',
    'insert into public.bank_connect_states (state, user_id, expires_at) values (repeat(''x'', 32), auth.uid(), now() + interval ''1 minute'')',
    format('insert into public.ingest_tokens (user_id, token_hash, prefix) values (%L, repeat(''b'', 64), ''abcdef'')', uA),     -- csak RPC
    format('update public.ingest_tokens set revoked_at = now() where id = %L', tokA),
    format('update public.ingest_tokens set allowed_apps = array[''x''] where id = %L', tokA),
    'delete from public.ingest_tokens',
    'insert into public.ingest_events (user_id, outcome) values (auth.uid(), ''recorded'')',
    'delete from public.ingest_events',
    format('insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, authorized_at, consent_valid_until) values (%L, ''x'', ''HU'', ''s9'', now(), now() + interval ''1 day'')', uA),
    'update public.bank_connections set consent_valid_until = now() + interval ''999 days''',
    'update public.bank_connections set sync_count_today = 0',
    'delete from public.bank_connections',
    format('insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, fingerprint) values (%L, ''bank'', ''booked'', 1, ''HUF'', current_date, repeat(''9'', 32))', uA),
    'update public.bank_transactions set amount = 1',
    'update public.bank_transactions set fingerprint = repeat(''z'', 32)',
    'update public.bank_transactions set matched_with = null',
    'delete from public.bank_transactions',
    'update public.profiles set bank_sync_allowed = true',                                  -- a gazdai kapu kliensről nem állítható
    format('insert into public.merchant_rules (user_id, match_key, category_id) values (%L, ''hack'', %L)', uB, catSys),          -- más nevében
    format('insert into public.merchant_rules (user_id, match_key, category_id) values (null, ''sys'', %L)', catSys),              -- rendszer-szabály
    'update public.merchant_rules set hits = 99',                                          -- a hits a szerveré
    'update public.merchant_rules set user_id = null'
  ] loop
    ok := false;
    begin execute s; exception when insufficient_privilege or check_violation then ok := true; end;
    assert ok, 'A-nak TILOS lenne: ' || s;
  end loop;

  -- A: ami szabad
  update public.profiles set budget_alerts = false where id = uA;
  get diagnostics n = row_count; assert n = 1, 'A nem állíthatja a budget_alerts-et';
  update public.bank_transactions set dismissed = true, category_id = catA where id = txA;
  get diagnostics n = row_count; assert n = 1, 'A nem sorolhatja át / utasíthatja el a tételét';
  ok := false;
  begin execute format('update public.bank_transactions set category_id = %L where id = %L', catB, txA);
  exception when insufficient_privilege or check_violation or foreign_key_violation then ok := true; end;
  assert ok, 'A más felhasználó kategóriájára sorolt át';
  insert into public.merchant_rules (match_key, category_id) values ('zzlidl', catSys) returning id into ruleA;      -- user_id = auth.uid() az alapértékből
  select count(*) into n from public.merchant_rules where match_key like 'zz%'; assert n = 3, 'A nem látja az új saját szabályát';
  update public.merchant_rules set match_key = 'zzlidl2' where id = ruleA; get diagnostics n = row_count; assert n = 1, 'A nem módosíthatja a saját szabályát';
  update public.merchant_rules set match_key = 'hack' where id = ruleSys; get diagnostics n = row_count; assert n = 0, 'A módosíthatja a rendszer-szabályt';
  delete from public.merchant_rules where id = ruleSys; get diagnostics n = row_count; assert n = 0, 'A törölheti a rendszer-szabályt';
  ok := false;
  begin insert into public.merchant_rules (match_key, category_id) values ('zzlidl2', catSys); exception when unique_violation then ok := true; end;
  assert ok, 'azonos kulcsú saját szabály kétszer bekerült';
  delete from public.merchant_rules where id = ruleA; get diagnostics n = row_count; assert n = 1, 'A nem törölheti a saját szabályát';

  -- A: kiadás-jelzők nem hamisíthatók
  insert into public.expenses (amount, source, is_provisional, merchant) values (5, 'bank', true, 'Hamis') returning id into expBank;
  select source || '/' || is_provisional::text into v from public.expenses where id = expBank;
  assert v = 'manual/false', 'a kliens beállíthatta a kiadás forrás-jelzőit: ' || v;
  ok := false;
  begin update public.expenses set source = 'bank' where id = expBank; exception when insufficient_privilege then ok := true; end;
  assert ok, 'A átírhatta az expenses.source-t';
  ok := false;
  begin update public.expenses set is_provisional = true where id = expBank; exception when insufficient_privilege then ok := true; end;
  assert ok, 'A átírhatta az expenses.is_provisional-t';
  update public.expenses set note = 'jegyzet', merchant = 'Saját' where id = expBank; get diagnostics n = row_count; assert n = 1, 'A nem szerkesztheti a kiadását';

  -- 4) tombstone: A törli a bankhoz kötött kiadását → a főkönyvi tétel dismissed, nem tér vissza
  update public.bank_transactions set dismissed = false where id = txA;
  delete from public.expenses where id = expA; get diagnostics n = row_count; assert n = 1, 'A nem törölheti a kiadását';
  select dismissed::text || '/' || coalesce(expense_id::text, 'null') into v from public.bank_transactions where id = txA;
  assert v = 'true/null', 'a törölt kiadás nem lett dismissed: ' || v;

  -- 5) B: semmit nem láthat/módosíthat A-ból
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  foreach s in array array['ingest_events','bank_connections','bank_transactions'] loop
    execute format('select count(*) from public.%I', s) into n;
    assert n = 0, format('B látja A %s sorait', s);
  end loop;
  select count(*) into n from public.ingest_tokens; assert n = 0, 'B látja A tokenjeit';
  select count(*) into n from public.merchant_rules where match_key like 'zz%'; assert n = 1, format('B %s szabályt lát (várt 1: csak a rendszer)', n);
  update public.bank_transactions set dismissed = false; get diagnostics n = row_count; assert n = 0, 'B módosíthatja A tételét';
  update public.merchant_rules set match_key = 'hack'; get diagnostics n = row_count; assert n = 0, 'B módosíthat szabályt';
  delete from public.merchant_rules; get diagnostics n = row_count; assert n = 0, 'B törölhet szabályt';
  foreach s in array array[
    format('insert into public.merchant_rules (match_key, category_id) values (''x1'', %L)', catA),                       -- A kategóriája
    format('update public.bank_transactions set category_id = %L', catA)
  ] loop
    ok := false;
    begin execute s; get diagnostics n = row_count; ok := (n = 0); exception when insufficient_privilege or check_violation or foreign_key_violation then ok := true; end;
    assert ok, 'B-nek TILOS lenne: ' || s;
  end loop;

  -- 6) anon semmit nem érhet el
  reset role; set local role anon;
  foreach s in array array['ingest_tokens','ingest_events','bank_connections','bank_connect_states','bank_transactions','merchant_rules'] loop
    ok := false;
    begin execute format('select count(*) from public.%I', s); exception when insufficient_privilege then ok := true; end;
    assert ok, 'anon olvashatja: ' || s;
  end loop;
  reset role;

  -- 7) fiók-törlés: a kaszkád (a tombstone-trigger közben) hibátlanul lefut, nem marad maradék
  delete from auth.users where id = uA;
  select count(*) into n from (
    select 1 from public.ingest_tokens where user_id = uA union all select 1 from public.ingest_events where user_id = uA
    union all select 1 from public.bank_connections where user_id = uA union all select 1 from public.bank_connect_states where user_id = uA
    union all select 1 from public.bank_transactions where user_id = uA union all select 1 from public.merchant_rules where user_id = uA
    union all select 1 from public.expenses where user_id = uA) r;
  assert n = 0, format('fiók-törlés után %s maradék sor', n);

  raise notice 'A-41 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

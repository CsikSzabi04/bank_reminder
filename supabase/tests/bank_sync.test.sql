-- A-48: banki szinkron — feldolgozás (kiadás / számla-kifizetés / megtakarítás), plafon, kézi kérés, lezárás. Tranzakcióban, ROLLBACK-kel.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  d0 date := (now() at time zone 'UTC')::date;
  now0 timestamptz := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + interval '2 hours';
  conn uuid; connB uuid; conn2 uuid; goal uuid; gro uuid;
  rNf uuid; rMvm uuid; rCl uuid; rSp uuid; r80 uuid; oNf uuid; oMvm uuid; oCl uuid; oSp uuid; o80 uuid;
  rows jsonb; r jsonb; n int; v text; ok boolean;
  acct text := 'h1:HUF';
begin
  insert into auth.users (id, aud, role, email) values (uA, 'authenticated', 'authenticated', 'a@sync.test'), (uB, 'authenticated', 'authenticated', 'b@sync.test');
  update public.profiles set timezone = 'UTC' where id in (uA, uB);
  select id into gro from public.categories where key = 'groceries' and user_id is null;

  -- 0) jogosultságok
  assert not has_function_privilege('authenticated', 'public.ingest_bank_transactions(uuid, text, jsonb, timestamptz)', 'execute'), 'a kliens hívhatja az ingest-et';
  assert not has_function_privilege('authenticated', 'public.reserve_bank_sync(uuid, text, timestamptz)', 'execute'), 'a kliens hívhatja a reserve-et';
  assert not has_function_privilege('authenticated', 'public.queue_bank_sync(uuid, text, timestamptz)', 'execute'), 'a kliens hívhatja a queue-t';
  assert not has_function_privilege('authenticated', 'public.finish_bank_sync(uuid, boolean, text, boolean, timestamptz)', 'execute'), 'a kliens hívhatja a finish-t';
  assert not has_function_privilege('authenticated', 'public.call_edge_function(text, jsonb)', 'execute'), 'a kliens hívhatja a call_edge_function-t';
  assert has_function_privilege('authenticated', 'public.request_bank_sync(uuid)', 'execute'), 'a kliens nem hívhatja a request_bank_sync-et';
  assert not has_function_privilege('anon', 'public.request_bank_sync(uuid)', 'execute'), 'anon hívhatja a request_bank_sync-et';
  assert not has_function_privilege('anon', 'public.normalize_merchant_key(text)', 'execute'), 'anon hívhatja a normalizálót';

  -- 1) a normalizáló (a Deno-oldali vektorok SQL-megfelelői) és a kulcsszó-trigger
  assert public.normalize_merchant_key('Árvíztűrő Tükörfúrógép') = 'arvizturo tukorfurogep', 'normalizáló 1';
  assert public.normalize_merchant_key('McDonald''s Budapest*123') = 'mcdonald s budapest 123', 'normalizáló 2';
  assert public.normalize_merchant_key('  OTP   Bank  ') = 'otp bank', 'normalizáló 3';
  assert public.normalize_merchant_key('Café-Étterem') = 'cafe etterem', 'normalizáló 4';
  assert public.normalize_merchant_key('ŐŰ őű') = 'ou ou', 'normalizáló 5';
  assert public.normalize_merchant_key('Spar #0042') = 'spar 0042', 'normalizáló 6';
  assert public.normalize_merchant_key('!!!') = '' and public.normalize_merchant_key(null) = '', 'normalizáló 7';

  -- 2) kapcsolat + számlák (A-nak aktív, B-nek egy másik)
  insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, accounts, authorized_at, consent_valid_until)
    values (uA, 'Revolut', 'HU', 'sess-a', '[{"uid":"u1","identification_hash":"h1","currency":"HUF","cash_account_type":"CACC","sync_enabled":true}]', now0 - interval '1 day', now0 + interval '170 days')
    returning id into conn;
  insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, accounts, authorized_at, consent_valid_until)
    values (uB, 'Revolut', 'HU', 'sess-b', '[{"uid":"u9","identification_hash":"h1","currency":"HUF"}]', now0 - interval '1 day', now0 + interval '170 days') returning id into connB;

  -- 3) A számlái, esedékességei és megtakarítási célja
  insert into public.reminders (user_id, name, amount, currency, start_date) values (uA, 'Netflix', 4500, 'HUF', d0 + 400) returning id into rNf;
  insert into public.reminders (user_id, name, amount, currency, start_date, bank_match) values (uA, 'Villany', 12000, 'HUF', d0 + 400, '  MVM Next! ') returning id into rMvm;
  insert into public.reminders (user_id, name, amount, currency, start_date) values (uA, 'Claude', 47000, 'HUF', d0 + 400) returning id into rCl;
  insert into public.reminders (user_id, name, amount, currency, start_date) values (uA, 'Spotify', 2000, 'HUF', d0 + 400) returning id into rSp;
  insert into public.reminders (user_id, name, amount, currency, start_date) values (uA, '80%', 2000, 'HUF', d0 + 400) returning id into r80;
  assert (select bank_match from public.reminders where id = rMvm) = 'mvm next', 'a bank_match nem normalizálódott';
  update public.reminders set bank_match = 'x' where id = rMvm;
  assert (select bank_match from public.reminders where id = rMvm) is null, 'az 1 karakteres bank_match megmaradt';
  update public.reminders set bank_match = 'mvm' where id = rMvm;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (rNf, uA, d0 + 2, 4500, 'HUF') returning id into oNf;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (rMvm, uA, d0 - 3, 12000, 'HUF') returning id into oMvm;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (rCl, uA, d0 + 1, 47000, 'HUF') returning id into oCl;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at, paid_amount) values (rSp, uA, d0 - 10, 2000, 'HUF', 'paid', d0 - 8, now0, 2000) returning id into oSp;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (r80, uA, d0, 2000, 'HUF') returning id into o80;
  insert into public.savings_goals (user_id, name, target_amount, currency, bank_match) values (uA, 'Nyaralás', 500000, 'HUF', 'Revolut Vault') returning id into goal;
  assert (select bank_match from public.savings_goals where id = goal) = 'revolut vault', 'a cél bank_match-e nem normalizálódott';

  -- a két számlához függő értesítés van: a kifizetés után törlődnie kell
  insert into public.notifications (user_id, kind, channel, reminder_id, occurrence_id, payload, scheduled_for, dedupe_key) values
    (uA, 'reminder', 'push', rNf, oNf, '{}', now0, 'sync-t-nf'), (uA, 'reminder', 'push', rMvm, oMvm, '{}', now0, 'sync-t-mvm');

  -- 4) az első köteg
  rows := jsonb_build_array(
    jsonb_build_object('ref','T1','booked_on',d0,'amount','4500.00','currency','HUF','direction','debit','counterparty','Netflix.com','remittance','Netflix elofizetes','merchant_key','netflix com'),
    jsonb_build_object('ref','T2','booked_on',d0,'amount','12300.00','currency','HUF','direction','debit','counterparty','MVM Next Zrt.','remittance','Villanyszamla','merchant_key','mvm next zrt'),
    jsonb_build_object('ref','T3','booked_on',d0,'amount','47000.00','currency','HUF','direction','debit','counterparty','Anthropic','remittance','Pro plan','merchant_key','anthropic'),
    jsonb_build_object('ref','T4','booked_on',d0 - 8,'amount','2000.00','currency','HUF','direction','debit','counterparty','Spotify AB','remittance',null,'merchant_key','spotify ab'),
    jsonb_build_object('ref','T5','booked_on',d0,'amount','10000.00','currency','HUF','direction','debit','counterparty','Revolut Vault','remittance','Megtakaritas','merchant_key','revolut vault'),
    jsonb_build_object('ref','T6','booked_on',d0,'amount','3500.00','currency','HUF','direction','debit','counterparty','Tesco Expressz','remittance',null,'merchant_key','tesco expressz'),
    jsonb_build_object('ref','T7','booked_on',d0,'amount','400000.00','currency','HUF','direction','credit','counterparty','Munkáltató Kft.','remittance','Fizetés','merchant_key','munkaltato kft'),
    jsonb_build_object('ref',null,'booked_on',d0,'amount','900.00','currency','HUF','direction','debit','counterparty','Kávézó','remittance',null,'merchant_key','kavezo'),
    jsonb_build_object('ref',null,'booked_on',d0,'amount','900.00','currency','HUF','direction','debit','counterparty','Kávézó','remittance',null,'merchant_key','kavezo'),
    jsonb_build_object('ref','X1','booked_on',d0,'amount','0','currency','HUF','direction','debit'),
    jsonb_build_object('ref','X2','booked_on',d0,'amount','5','currency','HU','direction','debit'),
    jsonb_build_object('ref','X3','booked_on',d0,'amount','5','currency','HUF','direction','sideways'),
    jsonb_build_object('ref','X4','amount','5','currency','HUF','direction','debit'));
  r := public.ingest_bank_transactions(conn, acct, rows, now0);
  assert r = jsonb_build_object('inserted', 9, 'duplicates', 0, 'skipped', 4, 'credits', 1, 'paid', 2, 'linked', 1, 'contributions', 1, 'expenses', 4), 'az első köteg eredménye hibás: ' || r::text;

  -- 4a) a számlák: kifizetve a banki tétel napjával/összegével, összekötve; a kézzel kifizetett érintetlen
  select status || '/' || paid_on::text || '/' || paid_amount::text into v from public.occurrences where id = oNf; assert v = 'paid/' || d0 || '/4500.00', 'a Netflix nem lett kifizetve: ' || v;
  select status || '/' || paid_amount::text into v from public.occurrences where id = oMvm; assert v = 'paid/12300.00', 'a villany (kulcsszó + ±5%) nem lett kifizetve: ' || v;
  select count(*) into n from public.bank_transactions where occurrence_id in (oNf, oMvm, oSp) and user_id = uA; assert n = 3, 'a számlák nincsenek összekötve a banki tétellel';
  select status || '/' || paid_on::text into v from public.occurrences where id = oSp; assert v = 'paid/' || (d0 - 8), 'a kézzel kifizetett számla megváltozott: ' || v;
  select status into v from public.occurrences where id = oCl; assert v = 'upcoming', 'a nem egyező nevű (Anthropic ≠ Claude) számla kifizetődött';
  select status into v from public.occurrences where id = o80; assert v = 'upcoming', 'a túl rövid névkulcsú („80%") számla kifizetődött';
  -- 4b) minden banki tétel pontosan EGYSZER számít: kiadás / számla / cél / jóváírás
  select count(*) into n from public.expenses where user_id = uA and source = 'bank'; assert n = 4, format('%s banki kiadás (várt 4: Anthropic, Tesco, 2 kávé)', n);
  select count(*) into n from public.expenses where user_id = uA and merchant in ('Netflix.com', 'MVM Next Zrt.', 'Spotify AB', 'Revolut Vault'); assert n = 0, 'számla/megtakarítás tételből kiadás is lett (dupla számolás)';
  select count(*) into n from public.bank_transactions where user_id = uA and expense_id is null and occurrence_id is null and contribution_id is null and direction = 'debit'; assert n = 0, 'van elszámolatlan terhelés';
  select count(*) into n from public.bank_transactions where user_id = uA and direction = 'credit' and expense_id is null; assert n = 1, 'a jóváírás kiadás lett';
  select count(*) into n from public.expenses e join public.bank_transactions b on b.expense_id = e.id where b.merchant = 'Tesco Expressz' and e.category_id = gro and b.category_id = gro; assert n = 1, 'a Tesco nem a rendszer-szabály kategóriájába került';
  select count(*) into n from public.expenses where user_id = uA and merchant = 'Kávézó'; assert n = 2, 'a két azonos kávé nem két külön kiadás';
  select count(*) into n from public.goal_contributions c join public.bank_transactions b on b.contribution_id = c.id where c.goal_id = goal and c.amount = 10000 and c.user_id = uA; assert n = 1, 'a megtakarítási befizetés hiányzik';
  select count(*) into n from public.notifications where user_id = uA and occurrence_id in (oNf, oMvm) and status = 'cancelled'; assert n = 2, 'a kifizetett számlák értesítései nem törlődtek';

  -- 5) idempotens újrafuttatás + átfedő ablak: semmi nem duplázódik, csak az új tétel kerül be
  r := public.ingest_bank_transactions(conn, acct, rows, now0 + interval '1 hour');
  assert r = jsonb_build_object('inserted', 0, 'duplicates', 9, 'skipped', 4, 'credits', 0, 'paid', 0, 'linked', 0, 'contributions', 0, 'expenses', 0), 'az újrafuttatás nem idempotens: ' || r::text;
  r := public.ingest_bank_transactions(conn, acct, rows || jsonb_build_array(jsonb_build_object('ref','T8','booked_on',d0,'amount','1200','currency','HUF','direction','debit','counterparty','Pék','merchant_key','pek')), now0 + interval '2 hours');
  assert (r ->> 'inserted')::int = 1 and (r ->> 'duplicates')::int = 9 and (r ->> 'expenses')::int = 1, 'az átfedő ablak hibás: ' || r::text;
  select count(*) into n from public.expenses where user_id = uA and source = 'bank'; assert n = 5, 'az újrafuttatás kiadást duplázott';

  -- 6) negatív esetek, MIKÖZBEN van szabad Netflix-esedékesség: másik pénznem, ablakon kívüli dátum, összeg-eltérés, rövid névkulcs → kiadás, nem kifizetés
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (rNf, uA, d0 + 5, 4500, 'HUF') returning id into oNf;
  r := public.ingest_bank_transactions(conn, acct, jsonb_build_array(
    jsonb_build_object('ref','N1','booked_on',d0,'amount','4500','currency','EUR','direction','debit','counterparty','Netflix','merchant_key','netflix'),
    jsonb_build_object('ref','N3','booked_on',d0 + 90,'amount','4500','currency','HUF','direction','debit','counterparty','Netflix','merchant_key','netflix'),
    jsonb_build_object('ref','N4','booked_on',d0,'amount','6000','currency','HUF','direction','debit','counterparty','Netflix','merchant_key','netflix'),
    jsonb_build_object('ref','N6','booked_on',d0,'amount','2000','currency','HUF','direction','debit','counterparty','Valami bolt 80','merchant_key','valami bolt 80')), now0 + interval '3 hours');
  assert (r ->> 'paid')::int = 0 and (r ->> 'expenses')::int = 4, 'a negatív esetek közül valamelyik számlát fizetett: ' || r::text;
  select status into v from public.occurrences where id = oNf; assert v = 'upcoming', 'a szabad Netflix-esedékesség kifizetődött: ' || v;
  -- a ±5%-on belüli tétel kifizeti; a következő azonos tételnek már nincs szabad esedékessége → kiadás
  r := public.ingest_bank_transactions(conn, acct, jsonb_build_array(jsonb_build_object('ref','N5','booked_on',d0,'amount','4600','currency','HUF','direction','debit','counterparty','Netflix','merchant_key','netflix')), now0 + interval '3 hours');
  assert (r ->> 'paid')::int = 1, 'a ±5%-on belüli tétel nem fizette ki a számlát: ' || r::text;
  r := public.ingest_bank_transactions(conn, acct, jsonb_build_array(jsonb_build_object('ref','N2','booked_on',d0,'amount','4500','currency','HUF','direction','debit','counterparty','Netflix','merchant_key','netflix')), now0 + interval '3 hours');
  assert (r ->> 'paid')::int = 0 and (r ->> 'expenses')::int = 1, 'a felhasznált esedékesség másodszor is kifizetődött: ' || r::text;

  -- 7) védelmek: ismeretlen számla, nem tömb, idegen/inaktív kapcsolat
  foreach v in array array['szamla', 'nem-tomb', 'nincs-kapcsolat', 'visszavont'] loop
    ok := false;
    begin
      case v
        when 'szamla' then perform public.ingest_bank_transactions(conn, 'masik:HUF', '[]', now0);
        when 'nem-tomb' then perform public.ingest_bank_transactions(conn, acct, '{}', now0);
        when 'nincs-kapcsolat' then perform public.ingest_bank_transactions(gen_random_uuid(), acct, '[]', now0);
        when 'visszavont' then
          update public.bank_connections set status = 'revoked' where id = conn;
          perform public.ingest_bank_transactions(conn, acct, '[]', now0);
      end case;
    exception when sqlstate '22023' or sqlstate 'BR404' then ok := true; end;
    assert ok, 'a védelem nem működött: ' || v;
  end loop;
  update public.bank_connections set status = 'active' where id = conn;
  -- B kapcsolatába A számlája nem írható, és B tételei nem érintik A adatait
  r := public.ingest_bank_transactions(connB, acct, jsonb_build_array(jsonb_build_object('ref','T1','booked_on',d0,'amount','4500','currency','HUF','direction','debit','counterparty','Netflix','merchant_key','netflix')), now0);
  assert (r ->> 'inserted')::int = 1 and (r ->> 'paid')::int = 0, 'B ugyanazon referenciájú tétele ütközött A-éval / A számláját fizette ki: ' || r::text;
  select count(*) into n from public.bank_transactions where user_id = uB; assert n = 1, 'B tétele nem külön sor';

  -- 8) a plafon: foglalás, 12 órás kézi korlát, 20 órás automatikus, napi 2, új nap, nem aktív
  insert into public.bank_connections (user_id, aspsp_name, aspsp_country, session_id, accounts, authorized_at, consent_valid_until)
    values (uA, 'OTP Bank', 'HU', 'sess-otp', '[]', now0 - interval '1 day', now0 + interval '170 days') returning id into conn2;
  assert public.reserve_bank_sync(conn2, 'auto', now0) ->> 'status' = 'queued', 'az első automatikus foglalás nem ment';
  r := public.reserve_bank_sync(conn2, 'manual', now0 + interval '11 hours 59 minutes');
  assert r ->> 'status' = 'too_soon' and (r ->> 'next_allowed_at')::timestamptz = now0 + interval '12 hours', 'a 12 órás kézi korlát hibás: ' || r::text;
  assert public.reserve_bank_sync(conn2, 'auto', now0 + interval '19 hours') ->> 'status' = 'too_soon', 'az automatikus 20 órás korlát hibás';
  assert public.reserve_bank_sync(conn2, 'manual', now0 + interval '12 hours') ->> 'status' = 'queued', 'a 12 óra utáni kézi foglalás nem ment';
  select sync_count_today::text into v from public.bank_connections where id = conn2; assert v = '2', 'a napi számláló hibás: ' || v;
  assert public.reserve_bank_sync(conn2, 'auto', now0 + interval '33 hours') ->> 'status' = 'queued', 'új napon nem nullázódott a számláló';
  select sync_count_today::text || '/' || sync_count_day::text into v from public.bank_connections where id = conn2; assert v = '1/' || ((now0 + interval '33 hours')::date), 'az új napi számláló hibás: ' || v;
  update public.bank_connections set sync_count_today = 2, sync_count_day = (now0 + interval '90 hours')::date, last_attempt_at = now0 + interval '40 hours' where id = conn2;
  assert public.reserve_bank_sync(conn2, 'manual', now0 + interval '90 hours') ->> 'status' = 'daily_limit', 'a napi 2 plafon nem érvényesül';
  update public.bank_connections set status = 'expired' where id = conn2;
  assert public.reserve_bank_sync(conn2, 'manual', now0 + interval '200 hours') ->> 'status' = 'not_active', 'lejárt kapcsolat foglalható';
  update public.bank_connections set status = 'active', consent_valid_until = now0 where id = conn2;
  assert public.reserve_bank_sync(conn2, 'manual', now0 + interval '300 hours') ->> 'status' = 'not_active', 'lejárt hozzáférésű kapcsolat foglalható';
  ok := false; begin perform public.reserve_bank_sync(conn2, 'sometimes', now0); exception when sqlstate '22023' then ok := true; end; assert ok, 'ismeretlen forrás elfogadva';
  ok := false; begin perform public.reserve_bank_sync(gen_random_uuid(), 'auto', now0); exception when sqlstate 'BR404' then ok := true; end; assert ok, 'ismeretlen kapcsolat foglalható';

  -- 9) a kézi kérés (B-41 szerződés): saját → queued; idegen → P0002; hitelesítés nélkül 28000; a hívás a bank-sync függvényre megy
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.request_bank_sync(conn);
  assert r ->> 'status' = 'queued' and (r ->> 'request_id') is not null, 'a kézi kérés nem sorba állt / nem indult el a bank-sync hívás: ' || r::text;
  r := public.request_bank_sync(conn);
  assert r ->> 'status' = 'too_soon' and r ? 'next_allowed_at', 'a második kézi kérés nem too_soon: ' || r::text;
  ok := false; begin perform public.request_bank_sync(connB); exception when sqlstate 'P0002' then ok := true; end; assert ok, 'idegen kapcsolatra lehet kérni';
  ok := false; begin perform public.request_bank_sync(gen_random_uuid()); exception when sqlstate 'P0002' then ok := true; end; assert ok, 'ismeretlen kapcsolatra lehet kérni';
  reset role;
  perform set_config('request.jwt.claims', '', true);
  set local role authenticated;
  ok := false; begin perform public.request_bank_sync(conn); exception when sqlstate '28000' then ok := true; end; assert ok, 'hitelesítés nélkül hívható';
  reset role;

  -- 10) lezárás: siker → last_success_at; hiba → csak a hiba (a siker-idő marad), a hibaüzenet csonkolt; lejárat → expired
  perform public.finish_bank_sync(conn, true, null, false, now0 + interval '5 hours');
  select (last_sync_ok)::text || '/' || (last_success_at = now0 + interval '5 hours')::text || '/' || coalesce(last_error, 'null') into v from public.bank_connections where id = conn; assert v = 'true/true/null', 'a sikeres lezárás hibás: ' || v;
  perform public.finish_bank_sync(conn, false, repeat('x', 500), false, now0 + interval '30 hours');
  select (last_sync_ok)::text || '/' || (last_success_at = now0 + interval '5 hours')::text || '/' || char_length(last_error)::text || '/' || status into v from public.bank_connections where id = conn;
  assert v = 'false/true/300/active', 'a hibás lezárás hibás: ' || v;
  perform public.finish_bank_sync(conn, false, 'expired', true, now0 + interval '31 hours');
  select status into v from public.bank_connections where id = conn; assert v = 'expired', 'a lejárt hozzáférés nem lett expired';

  raise notice 'A-48 SQL-teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

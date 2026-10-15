-- A-47: a bank-összekötés SQL-logikája (state, rögzítés, megújítás, csere, visszavonás). Tranzakcióban, ROLLBACK-kel.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  now0 timestamptz := now();
  r jsonb; cid uuid; cid2 uuid; n int; v text; ok boolean; st text;
  acc jsonb := '[{"uid":"u1","identification_hash":"h1","currency":"HUF","cash_account_type":"CACC","iban_last4":"6581","name":"Fő","sync_enabled":true},
                 {"uid":"u2","identification_hash":"h1","currency":"USD","cash_account_type":"CACC","iban_last4":"6581","name":"USD","sync_enabled":true},
                 {"uid":"u3","identification_hash":"h3","currency":"HUF","cash_account_type":"SVGS","iban_last4":null,"name":"Megtakarítás","sync_enabled":false}]';
begin
  insert into auth.users (id, aud, role, email) values (uA, 'authenticated', 'authenticated', 'a@flow.test'), (uB, 'authenticated', 'authenticated', 'b@flow.test');

  -- 1) a függvények kliensről nem hívhatók
  assert not has_function_privilege('authenticated', 'public.start_bank_connect(uuid, text, uuid, timestamptz)', 'execute'), 'a kliens hívhatja a start_bank_connect-et';
  assert not has_function_privilege('authenticated', 'public.consume_bank_connect_state(text, uuid, timestamptz)', 'execute'), 'a kliens hívhatja a consume-ot';
  assert not has_function_privilege('authenticated', 'public.finish_bank_connection(uuid, uuid, text, text, text, jsonb, timestamptz, timestamptz)', 'execute'), 'a kliens hívhatja a finish-t';
  assert not has_function_privilege('authenticated', 'public.revoke_bank_connection(uuid, uuid)', 'execute'), 'a kliens hívhatja a revoke-ot';
  assert not has_function_privilege('anon', 'public.consume_bank_connect_state(text, uuid, timestamptz)', 'execute'), 'anon hívhatja a consume-ot';

  -- 2) state: egyszer használható, csak a sajátja, lejárat után nem
  perform public.start_bank_connect(uA, repeat('a', 36), null, now0);
  r := public.consume_bank_connect_state(repeat('a', 36), uB, now0 + interval '1 minute');
  assert r ->> 'status' = 'invalid', 'idegen felhasználó state-je elfogadva: ' || r::text;
  r := public.consume_bank_connect_state(repeat('z', 36), uA, now0);
  assert r ->> 'status' = 'invalid', 'ismeretlen state elfogadva';
  r := public.consume_bank_connect_state(repeat('a', 36), uA, now0 + interval '1 minute');
  assert r ->> 'status' = 'ok', 'érvényes state elutasítva: ' || r::text;
  r := public.consume_bank_connect_state(repeat('a', 36), uA, now0 + interval '2 minutes');
  assert r ->> 'status' = 'invalid', 'a state kétszer felhasználható';
  perform public.start_bank_connect(uA, repeat('b', 36), null, now0);
  r := public.consume_bank_connect_state(repeat('b', 36), uA, now0 + interval '10 minutes');
  assert r ->> 'status' = 'expired', 'a lejárt state elfogadva (pont 10 perc): ' || r::text;
  perform public.start_bank_connect(uA, repeat('c', 36), null, now0);
  r := public.consume_bank_connect_state(repeat('c', 36), uA, now0 + interval '9 minutes 59 seconds');
  assert r ->> 'status' = 'ok', 'a még érvényes (9:59) state elutasítva';

  -- 3) ráta-korlát: óránként 10 indítás (a fentiek már 3-at használtak)
  for n in 1..7 loop perform public.start_bank_connect(uA, 'rate-' || n || repeat('x', 30), null, now0); end loop;
  ok := false;
  begin perform public.start_bank_connect(uA, repeat('r', 36), null, now0); exception when sqlstate 'BR429' then ok := true; end;
  assert ok, 'a 11. indítás is átment egy órán belül';
  perform public.start_bank_connect(uA, repeat('s', 36), null, now0 + interval '61 minutes');   -- egy óra múlva újra szabad
  perform public.start_bank_connect(uB, repeat('t', 36), null, now0);                           -- a korlát felhasználónkénti

  -- 4) új kapcsolat rögzítése: számlák, lejárat
  r := public.finish_bank_connection(uA, null, 'Revolut', 'HU', 'sess-1', acc, now0, now0 + interval '180 days');
  cid := (r ->> 'connection_id')::uuid;
  assert jsonb_array_length(r -> 'old_session_ids') = 0, 'az első kapcsolatnál nincs lecserélt session';
  select count(*) into n from public.bank_connections where id = cid and user_id = uA and status = 'active' and consent_valid_until = now0 + interval '180 days' and jsonb_array_length(accounts) = 3;
  assert n = 1, 'a kapcsolat nem a várt módon jött létre';
  select count(*) into n from public.bank_connections where id = cid and accounts::text ~ '[A-Z]{2}[0-9]{2}[0-9 ]{10,}'; assert n = 0, 'teljes IBAN-szerű érték került a számla-listába';

  -- 5) azonos bank újra összekötése (új kapcsolat): a régi revoked, a session-je visszajön a törléshez
  r := public.finish_bank_connection(uA, null, 'Revolut', 'HU', 'sess-2', acc, now0 + interval '1 day', now0 + interval '181 days');
  cid2 := (r ->> 'connection_id')::uuid;
  assert cid2 <> cid, 'az új kapcsolat azonos azonosítót kapott';
  assert r -> 'old_session_ids' = '["sess-1"]'::jsonb, 'a lecserélt session nem jött vissza: ' || (r -> 'old_session_ids')::text;
  select status into st from public.bank_connections where id = cid; assert st = 'revoked', 'a régi kapcsolat nem lett revoked';
  select count(*) into n from public.bank_connections where user_id = uA and status = 'active'; assert n = 1, format('%s aktív kapcsolat (várt 1)', n);
  -- más bank nem érintett
  r := public.finish_bank_connection(uA, null, 'OTP Bank', 'HU', 'sess-otp', '[]', now0, now0 + interval '90 days');
  select count(*) into n from public.bank_connections where user_id = uA and status = 'active'; assert n = 2, 'a másik bank kapcsolata lecserélődött';

  -- 6) megújítás: ugyanaz a sor, új session, a számlánkénti sync_enabled megmarad (hash + pénznem szerint)
  update public.bank_connections set accounts = (select jsonb_agg(case when e ->> 'currency' = 'USD' then e || '{"sync_enabled": false}'::jsonb else e end) from jsonb_array_elements(accounts) e),
         last_error = 'régi hiba', status = 'expired' where id = cid2;
  r := public.finish_bank_connection(uA, cid2, 'Revolut', 'HU', 'sess-3', acc, now0 + interval '2 days', now0 + interval '182 days');
  assert (r ->> 'connection_id')::uuid = cid2, 'a megújítás új sort hozott létre';
  assert r -> 'old_session_ids' = '["sess-2"]'::jsonb, 'a megújított régi session nem jött vissza';
  select count(*) into n from public.bank_connections where user_id = uA and aspsp_name = 'Revolut'; assert n = 2, 'a megújítás extra sort hozott létre';
  select status || '/' || coalesce(last_error, 'null') || '/' || session_id into v from public.bank_connections where id = cid2;
  assert v = 'active/null/sess-3', 'a megújított sor állapota hibás: ' || v;
  select count(*) into n from public.bank_connections c, jsonb_array_elements(c.accounts) e
   where c.id = cid2 and e ->> 'currency' = 'USD' and (e ->> 'sync_enabled')::boolean = false; assert n = 1, 'a USD számla sync_enabled=false nem maradt meg';
  select count(*) into n from public.bank_connections c, jsonb_array_elements(c.accounts) e
   where c.id = cid2 and e ->> 'cash_account_type' = 'SVGS' and (e ->> 'sync_enabled')::boolean = false; assert n = 1, 'a megtakarítási számla jelzője elveszett';
  select count(*) into n from public.bank_connections c, jsonb_array_elements(c.accounts) e
   where c.id = cid2 and e ->> 'name' = 'Fő' and (e ->> 'sync_enabled')::boolean = true; assert n = 1, 'a HUF folyószámla jelzője hibás';
  assert (select consent_valid_until from public.bank_connections where id = cid2) = now0 + interval '182 days', 'a megújított lejárat nem frissült';
  -- új számla a megújításnál az alapértéket kapja (nem volt korábban)
  r := public.finish_bank_connection(uA, cid2, 'Revolut', 'HU', 'sess-4', acc || '[{"uid":"u9","identification_hash":"h9","currency":"EUR","cash_account_type":"CACC","sync_enabled":true}]', now0 + interval '3 days', now0 + interval '183 days');
  select count(*) into n from public.bank_connections c, jsonb_array_elements(c.accounts) e where c.id = cid2 and e ->> 'currency' = 'EUR' and (e ->> 'sync_enabled')::boolean = true;
  assert n = 1, 'az új számla nem került be az alapértékkel';

  -- 7) idegen / visszavont kapcsolat nem újítható
  foreach st in array array['other', 'revoked'] loop
    ok := false;
    begin
      if st = 'other' then perform public.finish_bank_connection(uB, cid2, 'Revolut', 'HU', 'sess-x', acc, now0, now0 + interval '10 days');
      else perform public.finish_bank_connection(uA, cid, 'Revolut', 'HU', 'sess-y', acc, now0, now0 + interval '10 days'); end if;
    exception when sqlstate 'BR404' then ok := true; end;
    assert ok, 'nem újítható kapcsolat (' || st || ') mégis megújult';
  end loop;
  ok := false;
  begin perform public.start_bank_connect(uB, repeat('q', 36), cid2, now0); exception when sqlstate 'BR404' then ok := true; end;
  assert ok, 'idegen kapcsolatra indult megújítás';
  perform public.start_bank_connect(uA, repeat('p', 36), cid2, now0 + interval '2 hours');
  r := public.consume_bank_connect_state(repeat('p', 36), uA, now0 + interval '2 hours 1 minute');
  assert (r ->> 'renew_connection_id')::uuid = cid2, 'a state nem vitte a megújítandó kapcsolatot';

  -- 8) visszavonás: státusz + session vissza; idempotens; idegen nem vonható vissza
  r := public.revoke_bank_connection(uA, cid2);
  assert r ->> 'session_id' = 'sess-4', 'a visszavont session nem jött vissza: ' || r::text;
  select status into st from public.bank_connections where id = cid2; assert st = 'revoked', 'a kapcsolat nem lett revoked';
  r := public.revoke_bank_connection(uA, cid2);
  assert r -> 'session_id' = 'null'::jsonb, 'a második visszavonás nem idempotens';
  ok := false;
  begin perform public.revoke_bank_connection(uB, cid2); exception when sqlstate 'BR404' then ok := true; end;
  assert ok, 'idegen kapcsolat visszavonható';

  -- 9) a megújítás-hivatkozás a kapcsolat törlésekor nullázódik (nem árvul el a state)
  delete from public.bank_connections where id = cid2;
  select count(*) into n from public.bank_connect_states where renew_connection_id is not null; assert n = 0, 'a törölt kapcsolatra mutató renew_connection_id megmaradt';

  raise notice 'A-47 SQL-teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

-- A-42 (szabályok) + atomi besorolás. Két felhasználó, RLS, mutációra bukó ellenőrzések. Tranzakcióban, ROLLBACK-kel.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  gro uuid; catA uuid; catA2 uuid; catB uuid;
  e1 uuid; e2 uuid; e3 uuid; e4 uuid; e5 uuid; e6 uuid; e8 uuid; eB uuid;
  t1 uuid; t2 uuid; t3 uuid; t4 uuid; t5 uuid; t6 uuid; t7 uuid; t8 uuid; tB uuid;
  r jsonb; n int; v text; ok boolean; h1 int; h2 int; rid uuid;
begin
  insert into auth.users (id, aud, role, email) values (uA, 'authenticated', 'authenticated', 'a@rules.test'), (uB, 'authenticated', 'authenticated', 'b@rules.test');
  select id into gro from public.categories where key = 'groceries' and user_id is null;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'A-egy', 'A-one') returning id into catA;
  insert into public.categories (user_id, name_hu, name_en) values (uA, 'A-kettő', 'A-two') returning id into catA2;
  insert into public.categories (user_id, name_hu, name_en) values (uB, 'B-egy', 'B-one') returning id into catB;

  -- 0) rendszer-szabályok: léteznek, normalizált alakúak, a kulcs ≥ 4 karakter, csak rendszer-kategóriára mutatnak; jogosultságok
  select count(*) into n from public.merchant_rules where user_id is null; assert n >= 20, format('csak %s rendszer-szabály', n);
  select count(*) into n from public.merchant_rules where user_id is null and (char_length(match_key) < 4 or match_key !~ '^[a-z0-9 ]+$'); assert n = 0, 'nem normalizált/rövid rendszer-szabály-kulcs';
  select count(*) into n from public.merchant_rules m where m.user_id is null and not exists (select 1 from public.categories c where c.id = m.category_id and c.user_id is null); assert n = 0, 'rendszer-szabály nem rendszer-kategóriára mutat';
  assert not has_function_privilege('anon', 'public.classify_bank_transaction(uuid, uuid, boolean)', 'execute'), 'anon hívhatja a classify-t';
  assert not has_function_privilege('anon', 'public.dismiss_bank_transaction(uuid)', 'execute'), 'anon hívhatja a dismiss-t';
  assert has_function_privilege('authenticated', 'public.classify_bank_transaction(uuid, uuid, boolean)', 'execute'), 'a kliens nem hívhatja a classify-t';
  assert not has_function_privilege('authenticated', 'public.match_merchant_category(uuid, text, boolean)', 'execute'), 'a kliens hívhatja a match_merchant_category-t';

  -- 1) előkészítés (postgres)
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant) values (uA, 4500, 'HUF', current_date, 'bank', 'Tesco Expressz') returning id into e1;
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant) values (uA, 3200, 'HUF', current_date, 'bank', 'Tesco Expressz Kőbánya') returning id into e2;
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant) values (uA, 2100, 'HUF', current_date, 'bank', 'Lidl') returning id into e3;
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant, category_id) values (uA, 900, 'HUF', current_date, 'bank', 'Tesco', catA2) returning id into e4;
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant) values (uA, 700, 'HUF', current_date, 'bank', 'Tesco törölt') returning id into e5;
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant) values (uA, 600, 'HUF', current_date, 'notification', 'Névtelen') returning id into e6;
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant) values (uA, 800, 'HUF', current_date, 'bank', 'Tesco Budapest') returning id into e8;
  insert into public.expenses (user_id, amount, currency, spent_on, source, merchant) values (uB, 1000, 'HUF', current_date, 'bank', 'Tesco') returning id into eB;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id) values
    (uA, 'bank', 'booked', 4500, 'HUF', current_date, 'Tesco Expressz', 'tesco expressz', repeat('1', 32), e1) returning id into t1;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id) values
    (uA, 'bank', 'booked', 3200, 'HUF', current_date - 1, 'Tesco Expressz Kőbánya', 'tesco expressz kobanya', repeat('2', 32), e2) returning id into t2;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id) values
    (uA, 'bank', 'booked', 2100, 'HUF', current_date, 'Lidl', 'lidl', repeat('3', 32), e3) returning id into t3;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id, category_id) values
    (uA, 'bank', 'booked', 900, 'HUF', current_date, 'Tesco', 'tesco', repeat('4', 32), e4, catA2) returning id into t4;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id, dismissed) values
    (uA, 'bank', 'booked', 700, 'HUF', current_date, 'Tesco törölt', 'tesco torolt', repeat('5', 32), e5, true) returning id into t5;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id) values
    (uA, 'notification', 'provisional', 600, 'HUF', current_date, null, null, repeat('6', 32), e6) returning id into t6;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint) values
    (uA, 'notification', 'provisional', 100, 'HUF', current_date, 'X', 'x', repeat('7', 32)) returning id into t7;                 -- 1 karakteres kulcs, kiadás nélkül
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id) values
    (uA, 'bank', 'booked', 800, 'HUF', current_date, 'Tesco Budapest', 'tesco budapest', repeat('8', 32), e8) returning id into t8;
  insert into public.bank_transactions (user_id, source, status, amount, currency, booked_on, merchant, merchant_key, fingerprint, expense_id) values
    (uB, 'bank', 'booked', 1000, 'HUF', current_date, 'Tesco', 'tesco expressz', repeat('9', 32), eB) returning id into tB;

  -- 2) A besorol szabály nélkül: csak ez a tétel + a kiadása változik
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  r := public.classify_bank_transaction(t3, catA, false);
  assert (r ->> 'classified')::int = 1 and r -> 'rule_id' = 'null'::jsonb, 'szabály nélküli besorolás eredménye hibás: ' || r::text;
  select count(*) into n from public.bank_transactions where id = t3 and category_id = catA; assert n = 1, 'a főkönyvi sor nem lett besorolva';
  select count(*) into n from public.expenses where id = e3 and category_id = catA; assert n = 1, 'a kiadás nem lett besorolva';
  select count(*) into n from public.merchant_rules where user_id = uA; assert n = 0, 'szabály jött létre kérés nélkül';

  -- 3) „Ezt mindig így" a „tesco expressz" kulccsal: a t1 + a TARTALMAZÓ pending t2 (a „tesco budapest" nem tartalmazza)
  r := public.classify_bank_transaction(t1, catA, true);
  assert (r ->> 'classified')::int = 2, 'a besorolt darabszám hibás: ' || r::text;
  rid := (r ->> 'rule_id')::uuid; assert rid is not null, 'nincs szabály-azonosító';
  select count(*) into n from public.merchant_rules where id = rid and user_id = uA and match_key = 'tesco expressz' and category_id = catA; assert n = 1, 'a szabály alakja hibás';
  select count(*) into n from public.bank_transactions where id in (t1, t2) and category_id = catA; assert n = 2, 'a tételek nem lettek besorolva';
  select count(*) into n from public.expenses where id in (e1, e2) and category_id = catA; assert n = 2, 'a kiadások nem lettek besorolva';
  select count(*) into n from public.bank_transactions where id = t8 and category_id is null; assert n = 1, 'a nem tartalmazó kulcsú tétel besorolódott';

  -- 4) rövidebb kulcs („tesco"): a még várakozó t8 sorolódik; a már besorolt t2/t4, a törölt t5 és B tétele nem
  reset role;
  update public.bank_transactions set merchant_key = 'tesco' where id = t1;     -- a merchant_key a szerveré (a kliens nem írhatja)
  set local role authenticated;
  r := public.classify_bank_transaction(t1, catA2, true);
  assert (r ->> 'classified')::int = 2, 'a „tesco" szabály besorolt darabszáma hibás: ' || r::text;
  select count(*) into n from public.merchant_rules where user_id = uA and match_key = 'tesco' and category_id = catA2; assert n = 1, 'a „tesco" szabály hiányzik';
  select count(*) into n from public.bank_transactions where id = t8 and category_id = catA2; assert n = 1, 'a „tesco budapest" tétel nem sorolódott';
  select count(*) into n from public.expenses where id = e8 and category_id = catA2; assert n = 1, 'a „tesco budapest" kiadása nem sorolódott';
  select count(*) into n from public.bank_transactions where id = t2 and category_id = catA; assert n = 1, 'a már besorolt tétel átíródott';
  reset role;
  select count(*) into n from public.bank_transactions where id = t4 and category_id = catA2; assert n = 1, 'a már besorolt (t4) tétel változott';
  select count(*) into n from public.bank_transactions where id = t5 and category_id is null; assert n = 1, 'a törölt (dismissed) tétel besorolódott';
  select count(*) into n from public.bank_transactions where id = tB and category_id is null; assert n = 1, 'B tétele besorolódott';
  select count(*) into n from public.expenses where id = eB and category_id is null; assert n = 1, 'B kiadása besorolódott';

  -- 5) ugyanaz a kulcs más kategóriával: a meglévő szabály kategóriája frissül (nem új sor)
  set local role authenticated;
  r := public.classify_bank_transaction(t1, catA, true);
  select count(*) into n from public.merchant_rules where user_id = uA and match_key = 'tesco'; assert n = 1, 'a szabály duplikálódott';
  select count(*) into n from public.merchant_rules where user_id = uA and match_key = 'tesco' and category_id = catA; assert n = 1, 'a szabály kategóriája nem frissült';

  -- 6) hibák: idegen/ismeretlen/törölt tétel, idegen kategória, hiányzó vagy rövid kulcs — részleges írás nélkül
  foreach v in array array['b-tetel', 'ismeretlen', 'dismissed', 'idegen-kategoria', 'nincs-kulcs', 'rovid-kulcs'] loop
    ok := false;
    begin
      case v
        when 'b-tetel' then perform public.classify_bank_transaction(tB, catA, false);
        when 'ismeretlen' then perform public.classify_bank_transaction(gen_random_uuid(), catA, false);
        when 'dismissed' then perform public.classify_bank_transaction(t5, catA, false);
        when 'idegen-kategoria' then perform public.classify_bank_transaction(t6, catB, false);
        when 'nincs-kulcs' then perform public.classify_bank_transaction(t6, catA, true);
        when 'rovid-kulcs' then perform public.classify_bank_transaction(t7, catA, true);
      end case;
    exception when sqlstate 'BR404' or sqlstate 'BR422' then ok := true; end;
    assert ok, 'a hibás hívás átment: ' || v;
  end loop;
  reset role;
  select count(*) into n from public.bank_transactions where id in (t6, t7, t5, tB) and category_id is not null; assert n = 0, 'a hibás hívás részlegesen írt';
  select count(*) into n from public.expenses where id in (e6, e5, eB) and category_id is not null; assert n = 0, 'a hibás hívás a kiadást részlegesen írta';
  set local role authenticated;
  ok := false; begin perform public.classify_bank_transaction(t6, catA, true); exception when sqlstate 'BR422' then ok := true; end; assert ok, 'a kulcs nélküli tétel nem BR422';
  ok := false; begin perform public.classify_bank_transaction(t7, catA, true); exception when sqlstate 'BR422' then ok := true; end; assert ok, 'a rövid kulcsú tétel nem BR422';
  ok := false; begin perform public.classify_bank_transaction(tB, catA, false); exception when sqlstate 'BR404' then ok := true; end; assert ok, 'az idegen tétel nem BR404';
  -- a szabály nélküli besorolás a kulcs nélküli tételre MEGY
  r := public.classify_bank_transaction(t6, catA, false); assert (r ->> 'classified')::int = 1, 'a kulcs nélküli tétel besorolása nem ment';
  reset role; set local role anon;
  ok := false; begin perform public.classify_bank_transaction(t6, catA, false); exception when insufficient_privilege then ok := true; end; assert ok, 'anon meghívta a classify-t';
  reset role;

  -- 7) „Ez nem kiadás": a kiadás törlődik, a sor dismissed (tombstone); kiadás nélküli tétel is dismissed; idegen tétel nem
  set local role authenticated;
  perform public.dismiss_bank_transaction(t3);
  perform public.dismiss_bank_transaction(t7);
  reset role;
  select count(*) into n from public.expenses where id = e3; assert n = 0, 'a kiadás nem törlődött';
  select count(*) into n from public.bank_transactions where id in (t3, t7) and dismissed and expense_id is null; assert n = 2, 'a tétel(ek) nem lettek dismissed';
  set local role authenticated;
  ok := false; begin perform public.dismiss_bank_transaction(tB); exception when sqlstate 'BR404' then ok := true; end; assert ok, 'A elvetette B tételét';
  ok := false; begin perform public.dismiss_bank_transaction(gen_random_uuid()); exception when sqlstate 'BR404' then ok := true; end; assert ok, 'ismeretlen tétel elvethető';
  ok := false; begin perform public.classify_bank_transaction(t3, catA, false); exception when sqlstate 'BR404' then ok := true; end; assert ok, 'dismissed tétel besorolható';
  reset role;
  select count(*) into n from public.expenses where id = eB; assert n = 1, 'B kiadása törlődött';

  -- 8) match_merchant_category (szerver-oldal): saját > rendszer (akkor is, ha rövidebb); hosszabb saját kulcs nyer; hits; B szabálya nem hat
  update public.merchant_rules set category_id = catA2 where user_id = uA and match_key = 'tesco expressz';
  assert public.match_merchant_category(uA, 'tesco expressz kobanya', false) = catA2, 'a hosszabb saját kulcs nem nyert';
  assert public.match_merchant_category(uA, 'tesco kobanya', false) = catA, 'a saját „tesco" szabály nem előzte meg a rendszer-szabályt';
  assert public.match_merchant_category(uB, 'tesco kobanya', false) = gro, 'B-re nem a rendszer-szabály hat (vagy A szabálya szivárog)';
  insert into public.merchant_rules (user_id, match_key, category_id) values (uA, 'penny', catA);           -- rövidebb saját kulcs a hosszabb rendszer-kulcs („penny market") ellen
  assert public.match_merchant_category(uA, 'penny market 12', false) = catA, 'a rövidebb saját szabály nem előzte meg a hosszabb rendszer-szabályt';
  assert public.match_merchant_category(uB, 'penny market 12', false) = gro, 'a rendszer-szabály nem találta a Penny Marketet';
  select hits into h1 from public.merchant_rules where user_id is null and match_key = 'lidl';
  perform public.match_merchant_category(uB, 'lidl', false);
  select hits into h2 from public.merchant_rules where user_id is null and match_key = 'lidl'; assert h2 = h1, 'p_hit=false mellett nőtt a hits';
  perform public.match_merchant_category(uB, 'lidl', true);
  select hits into h2 from public.merchant_rules where user_id is null and match_key = 'lidl'; assert h2 = h1 + 1, 'a találat nem növelte a hits-et';
  assert public.match_merchant_category(uA, 'ismeretlen bolt') is null, 'találat ismeretlen kulcsra';
  assert public.match_merchant_category(uA, 'x') is null and public.match_merchant_category(uA, null) is null and public.match_merchant_category(uA, '') is null, 'rövid/üres kulcsra találat';

  raise notice 'A-42 szabály-teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

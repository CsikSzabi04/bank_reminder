-- elszigetelés: az élő adatoktól független (a tranzakció visszagörgetődik)
delete from public.fx_rates;
-- A-07: ismétlődés-vektorok (V1–V7), esedékesség-szinkron, kifizetés-RPC-k, auto_paid, fx_convert, v_occurrences.
-- Futtatás: tranzakcióban, ROLLBACK-kel. A "most" fix (p_now), így a teszt nem függ a futtatás napjától.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  rem uuid; remAuto uuid; occ uuid; o public.occurrences;
  fixed timestamptz := timestamptz '2026-10-13 12:00:00+00'; tdy date := date '2026-10-13'; hz date := date '2027-02-10';
  got date[]; n int; ok boolean; v numeric; b boolean;
  function_dummy int;
begin
  -- ── V1–V7 ──
  select array_agg(d order by d) into got from public.occurrence_dates('month', 1, date '2026-01-31', false, date '2026-01-01', date '2026-12-31') d;
  assert got[1:5] = array[date '2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'], 'V1: ' || got::text;
  select array_agg(d order by d) into got from public.occurrence_dates('month', 1, date '2026-01-30', true, date '2026-01-01', date '2026-03-31') d;
  assert got = array[date '2026-01-31', '2026-02-28', '2026-03-31'], 'V2: ' || got::text;
  select array_agg(d order by d) into got from public.occurrence_dates('year', 1, date '2024-02-29', false, date '2024-01-01', date '2028-12-31') d;
  assert got = array[date '2024-02-29', '2025-02-28', '2026-02-28', '2027-02-28', '2028-02-29'], 'V3: ' || got::text;
  select array_agg(d order by d) into got from public.occurrence_dates('week', 2, date '2026-10-13', false, date '2026-10-01', date '2026-11-30') d;
  assert got = array[date '2026-10-13', '2026-10-27', '2026-11-10', '2026-11-24'], 'V4: ' || got::text;
  select array_agg(d order by d) into got from public.occurrence_dates(null, 1, date '2026-11-10', false, date '2026-01-01', date '2027-01-01') d;
  assert got = array[date '2026-11-10'], 'V5: ' || got::text;
  select array_agg(d order by d) into got from public.occurrence_dates('month', 3, date '2026-11-15', false, date '2026-01-01', date '2027-12-31') d;
  assert got[1:3] = array[date '2026-11-15', '2027-02-15', '2027-05-15'], 'V6: ' || got::text;
  select array_agg(d order by d) into got from public.occurrence_dates('day', 10, date '2026-10-13', false, date '2026-10-01', date '2026-11-05') d;
  assert got = array[date '2026-10-13', '2026-10-23', '2026-11-02'], 'V7: ' || got::text;
  -- ablak a sorozat közepén: a "from" utáni elemek, helyes fázissal
  select array_agg(d order by d) into got from public.occurrence_dates('month', 1, date '2025-01-10', false, date '2026-10-13', date '2027-01-31') d;
  assert got = array[date '2026-11-10', '2026-12-10', '2027-01-10'], 'ablak: ' || got::text;
  select array_agg(d order by d) into got from public.occurrence_dates('month', 1, date '2026-11-10', false, date '2026-10-13', date '2027-01-31', date '2026-12-31') d;
  assert got = array[date '2026-11-10', '2026-12-10'], 'end_date: ' || got::text;
  select array_agg(d order by d) into got from public.preview_dates('month', 1, date '2026-11-10', false, 3) d;
  assert got = array[date '2026-11-10', '2026-12-10', '2027-01-10'], 'preview: ' || got::text;

  -- ── felhasználók ──
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (uB, 'authenticated', 'authenticated', 'b@example.test', '{}');

  -- ── J3: Netflix, havonta 10-én ──
  insert into public.reminders (user_id, name, amount, start_date, recur_unit, is_subscription)
    values (uA, 'Netflix', 2300, date '2026-10-10', 'month', true) returning id into rem;
  delete from public.occurrences where reminder_id = rem;
  perform public.ensure_occurrences(rem, 120, fixed);
  select array_agg(due_date order by due_date) into got from public.occurrences where reminder_id = rem and due_date between tdy and hz;
  assert got = array[date '2026-11-10', '2026-12-10', '2027-01-10', '2027-02-10'], 'J3: ' || got::text;
  perform public.ensure_occurrences(rem, 120, fixed);                                  -- idempotens
  select count(*) into n from public.occurrences where reminder_id = rem and due_date between tdy and hz;
  assert n = 4, 'nem idempotens: ' || n;

  -- ── kifizetés RPC (A bejelentkezve) ──
  select id into occ from public.occurrences where reminder_id = rem and due_date = date '2026-11-10';
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.mark_paid(occ); exception when sqlstate 'P0002' then ok := true; end;
  assert ok, 'B kifizetheti A tételét';
  ok := false; begin perform public.skip_occurrence(occ); exception when sqlstate 'P0002' then ok := true; end;
  assert ok, 'B kihagyhatja A tételét';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.mark_paid(occ, -1); exception when sqlstate '22023' then ok := true; end;
  assert ok, 'negatív összeg elfogadva';
  ok := false; begin perform public.mark_paid(occ, null, current_date + 5); exception when sqlstate '22023' then ok := true; end;
  assert ok, 'jövőbeli paid_on elfogadva';
  o := public.mark_paid(occ, 2500);
  assert o.status = 'paid' and o.paid_amount = 2500 and o.paid_at is not null and o.paid_on is not null, 'mark_paid hibás';
  ok := false; begin execute 'update public.occurrences set status = ''upcoming'''; exception when insufficient_privilege then ok := true; end;
  assert ok, 'közvetlen occurrences-írás engedett';
  o := public.mark_unpaid(occ);
  assert o.status = 'upcoming' and o.paid_at is null and o.paid_on is null and o.paid_amount is null, 'mark_unpaid hibás';
  o := public.skip_occurrence(occ);
  assert o.status = 'skipped', 'skip hibás';
  o := public.mark_paid(occ);
  assert o.status = 'paid', 'skipped → paid hibás';
  reset role;

  -- ── szabály-módosítás: a paid múlt marad, a jövő változik ──
  update public.reminders set start_date = date '2026-10-15', amount = 2600 where id = rem;
  perform public.ensure_occurrences(rem, 120, fixed);
  select array_agg(due_date order by due_date) into got from public.occurrences
    where reminder_id = rem and due_date between tdy and hz and status = 'upcoming';
  assert got = array[date '2026-10-15', '2026-11-15', '2026-12-15', '2027-01-15'], 'szabály-módosítás: ' || got::text;
  select count(*) into n from public.occurrences where id = occ and status = 'paid' and amount = 2300;
  assert n = 1, 'a kifizetett sor összege/állapota megváltozott';
  select count(*) into n from public.occurrences where reminder_id = rem and status = 'upcoming' and amount <> 2600;
  assert n = 0, 'a jövőbeli sorok összege nem frissült';

  -- ── deaktiválás: a jövő upcoming törlődik, a paid marad ──
  update public.reminders set is_active = false where id = rem;
  perform public.ensure_occurrences(rem, 120, fixed);
  select count(*) into n from public.occurrences where reminder_id = rem and status = 'upcoming' and due_date >= tdy;
  assert n = 0, 'deaktiválás után maradt jövőbeli upcoming';
  select count(*) into n from public.occurrences where id = occ; assert n = 1, 'a paid sor eltűnt';

  -- ── v_occurrences: overdue ──
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency)
    values (rem, uA, date '2020-01-01', 100, 'HUF');
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select overdue into b from public.v_occurrences where due_date = date '2020-01-01'; assert b is true, 'overdue nem látszik';
  select overdue into b from public.v_occurrences where id = occ; assert b is false, 'paid sor overdue';
  reset role;

  -- ── csoportos beszedés ──
  insert into public.reminders (user_id, name, amount, start_date, recur_unit, auto_paid)
    values (uA, 'Rezsi', 15000, date '2026-10-01', 'month', true) returning id into remAuto;
  delete from public.occurrences where reminder_id = remAuto;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (remAuto, uA, date '2026-10-05', 15000, 'HUF'), (remAuto, uA, date '2026-10-20', 15000, 'HUF');
  perform public.process_auto_paid(fixed);
  select count(*) into n from public.occurrences where reminder_id = remAuto and status = 'paid' and due_date = date '2026-10-05' and paid_on = date '2026-10-05';
  assert n = 1, 'auto_paid nem fizette ki az esedékeset';
  select count(*) into n from public.occurrences where reminder_id = remAuto and status = 'upcoming' and due_date = date '2026-10-20';
  assert n = 1, 'auto_paid a jövőbelit is kifizette';

  -- ── fx_convert ──
  insert into public.fx_rates (as_of, currency, per_eur) values (date '2026-10-12', 'HUF', 360), (date '2026-10-12', 'USD', 1.2), (date '2026-10-13', 'HUF', 364.31);
  v := public.fx_convert(100, 'EUR', 'HUF', date '2026-10-13'); assert v = 36431, 'EUR→HUF: ' || v;
  v := public.fx_convert(364.31, 'HUF', 'EUR', date '2026-10-13'); assert round(v, 6) = 1, 'HUF→EUR: ' || v;
  v := public.fx_convert(120, 'USD', 'HUF', date '2026-10-12'); assert v = 36000, 'USD→HUF: ' || v;
  v := public.fx_convert(5, 'HUF', 'HUF', date '2026-10-13'); assert v = 5, 'azonos pénznem';
  assert public.fx_convert(5, 'CHF', 'HUF', date '2026-10-13') is null, 'hiányzó árfolyam nem NULL';
  assert public.fx_convert(5, 'HUF', 'HUF', date '2020-01-01') = 5, 'azonos pénznem régi napon';

  -- ── jogosultság: a háttér-függvényeket a kliens nem hívhatja ──
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.ensure_occurrences(rem); exception when insufficient_privilege then ok := true; end;
  assert ok, 'ensure_occurrences hívható klienstől';
  ok := false; begin perform public.process_auto_paid(); exception when insufficient_privilege then ok := true; end;
  assert ok, 'process_auto_paid hívható klienstől';
  reset role;
  set local role anon;
  ok := false; begin perform public.mark_paid(occ); exception when insufficient_privilege then ok := true; end;
  assert ok, 'anon hívhatja a mark_paid-et';
  reset role;

  raise notice 'A-07 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

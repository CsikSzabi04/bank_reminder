-- A-21: tippek-motor — a gazda példája (Netflix/HBO/Prime), negatív esetek, életciklus, árváltozás, próbaidő, duplikátum, késés, használat, keret, jogosultság.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); uC uuid := gen_random_uuid();
  tdy date := (now() at time zone 'Europe/Budapest')::date; C date;
  rN uuid; rH uuid; rP uuid; rS uuid; rT uuid; rD1 uuid; rD2 uuid; rL uuid; rU uuid; cShop uuid;
  t public.tips; n int; v numeric; ok boolean; j jsonb;
begin
  C := public.month_start(tdy);
  select id into cShop from public.categories where key = 'shopping' and user_id is null;
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (uB, 'authenticated', 'authenticated', 'b@example.test', '{}'), (uC, 'authenticated', 'authenticated', 'c@example.test', '{}');

  -- ── 1) a gazda példája: Netflix 2300, HBO Max 2000, Prime 3000 (havi) ──
  insert into public.reminders (user_id, name, amount, is_subscription, recur_unit, start_date, service_slug) values
    (uA, 'Netflix', 2300, true, 'month', tdy + 3, 'netflix') returning id into rN;
  insert into public.reminders (user_id, name, amount, is_subscription, recur_unit, start_date, service_slug) values
    (uA, 'HBO Max', 2000, true, 'month', tdy + 4, 'hbo-max') returning id into rH;
  insert into public.reminders (user_id, name, amount, is_subscription, recur_unit, start_date, service_slug) values
    (uA, 'Prime Video', 3000, true, 'month', tdy + 5, 'prime-video') returning id into rP;
  update public.reminders set created_at = now() - interval '5 days' where user_id = uA;

  perform public.compute_tips(uA);
  select * into t from public.tips where user_id = uA and code = 'sub_overlap_group';
  assert t.severity = 'save' and (t.params ->> 'count')::int = 3 and t.est_monthly_saving = 2000 and t.fingerprint = 'overlap:video_streaming', 'overlap: ' || t::text;
  select count(*) into n from public.tips where user_id = uA and code = 'sub_maybe_redundant'; assert n = 3, 'rákérdezés ×3 várt: ' || n;
  select count(*) into n from public.tips where user_id = uA and code = 'sub_covered_by_others'; assert n = 0, 'címke nélkül nem lehet fedett';

  -- a felhasználó megjelöli, mit néz: Netflix {filmek, sorozatok, eredeti}, HBO {filmek, sorozatok}, Prime {filmek, sorozatok}
  update public.reminders set usage_tags = '{movies,series,originals}' where id = rN;
  update public.reminders set usage_tags = '{movies,series}' where id in (rH, rP);
  perform public.compute_tips(uA);
  select count(*) into n from public.tips where user_id = uA and code = 'sub_maybe_redundant'; assert n = 0, 'a rákérdezés megmaradt';
  select * into t from public.tips where user_id = uA and code = 'sub_covered_by_others';
  assert t.reminder_ids = array[rP] and t.est_monthly_saving = 3000 and t.params ->> 'name' = 'Prime Video', 'a Prime nem a javasolt: ' || t::text;   -- a legdrágább fedett
  select count(*) into n from public.tips where user_id = uA and code = 'sub_covered_by_others'; assert n = 1, 'csoportonként legfeljebb 1 lemondási javaslat';

  -- negatív: a Prime-on a felhasználó „saját eredeti műsorokat" is néz → nem fedett; helyette a HBO (a következő legdrágább fedett)
  update public.reminders set usage_tags = '{movies,series,originals}' where id = rP;
  perform public.compute_tips(uA);
  select * into t from public.tips where user_id = uA and code = 'sub_covered_by_others'; assert t.reminder_ids = array[rH], 'originals esetén nem a Prime: ' || t::text;
  -- negatív: a Prime-on sportot néz, amit más nem fed → senki sem fedett (HBO: filmek/sorozatok a Netflixen van → HBO fedett marad), Prime nem
  update public.reminders set usage_tags = '{sports}' where id = rP;
  perform public.compute_tips(uA);
  select count(*) into n from public.tips where user_id = uA and code = 'sub_covered_by_others' and reminder_ids = array[rP]; assert n = 0, 'a sport lefedettnek látszik';
  -- minden jelölt saját: senki nem fedett
  update public.reminders set usage_tags = '{documentary}' where id = rH;
  update public.reminders set usage_tags = '{kids}' where id = rN;
  perform public.compute_tips(uA);
  select count(*) into n from public.tips where user_id = uA and code = 'sub_covered_by_others'; assert n = 0, 'egyedi használatnál is fedettet jelzett';

  -- ── 2) életciklus ──
  select * into t from public.tips where user_id = uA and code = 'sub_overlap_group';
  perform public.compute_tips(uA);
  select count(*) into n from public.tips where user_id = uA and code = 'sub_overlap_group'; assert n = 1, 'nem idempotens';
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.tip_action(t.id, 'seen');
  select status into t.status from public.tips where id = t.id; assert t.status = 'seen', 'seen: ' || t.status;
  perform public.tip_action(t.id, 'dismiss');
  reset role;
  perform public.compute_tips(uA);
  select status into t.status from public.tips where id = t.id; assert t.status = 'dismissed', 'dismissed tipp visszatért: ' || t.status;
  set local role authenticated; perform public.tip_action(t.id, 'snooze'); reset role;
  select status, snoozed_until into t.status, t.snoozed_until from public.tips where id = t.id; assert t.status = 'snoozed' and t.snoozed_until = tdy + 30, 'snooze';
  perform public.compute_tips(uA, now() + interval '31 days');                 -- a halasztás lejárt → újra „new"
  select status into t.status from public.tips where id = t.id; assert t.status = 'new', 'halasztás lejárta után: ' || t.status;
  -- a megszűnt feltételű (new) tipp törlődik
  update public.reminders set is_active = false where id in (rN, rH);   -- 1 aktív marad → nincs átfedés
  perform public.compute_tips(uA);
  select count(*) into n from public.tips where id = t.id; assert n = 0, 'a megszűnt tipp megmaradt';
  update public.reminders set is_active = true where id in (rN, rH);

  -- ── 3) B nem nyúlhat A tippjéhez ──
  select id into t.id from public.tips where user_id = uA limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.tips; assert n = 0, 'B látja A tippjeit';
  ok := false; begin perform public.tip_action(t.id, 'dismiss'); exception when sqlstate 'P0002' then ok := true; end; assert ok, 'B elvetheti A tippjét';
  ok := false; begin perform public.compute_tips(uA); exception when insufficient_privilege then ok := true; end; assert ok, 'compute_tips hívható klienstől';
  reset role;

  -- ── 4) árváltozás: 1990 → 2290 (+15,1%) ──
  insert into public.reminders (user_id, name, amount, is_subscription, recur_unit, start_date) values (uC, 'Spotify', 2290, true, 'month', tdy - 20) returning id into rS;
  delete from public.occurrences where reminder_id = rS;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at) values (rS, uC, tdy - 20, 1990, 'HUF', 'paid', tdy - 20, now());
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status) values (rS, uC, tdy + 5, 2290, 'HUF', 'upcoming');
  perform public.compute_tips(uC);
  select * into t from public.tips where user_id = uC and code = 'price_increase';
  assert (t.params ->> 'pct')::numeric = 15.1 and t.est_monthly_saving = 300 and t.severity = 'warn', 'árváltozás: ' || coalesce(t::text, 'NULL');
  update public.occurrences set amount = 2000 where reminder_id = rS and due_date = tdy + 5;                  -- +0,5% < 5% küszöb
  perform public.compute_tips(uC);
  select count(*) into n from public.tips where user_id = uC and code = 'price_increase'; assert n = 0, 'küszöb alatti változás tippet adott';

  -- ── 5) próbaidő ──
  insert into public.reminders (user_id, name, amount, recur_unit, start_date, trial_ends_on) values (uC, 'Próba közel', 2990, 'month', tdy + 20, tdy + 2) returning id into rT;
  insert into public.reminders (user_id, name, amount, recur_unit, start_date, trial_ends_on) values (uC, 'Próba messze', 2990, 'month', tdy + 20, tdy + 10);
  perform public.compute_tips(uC);
  select count(*) into n from public.tips where user_id = uC and code = 'trial_ending'; assert n = 1, 'trial tippek: ' || n;

  -- ── 6) duplikátum ──
  insert into public.reminders (user_id, name, amount, start_date) values (uC, 'Netflix', 2300, tdy + 9) returning id into rD1;
  insert into public.reminders (user_id, name, amount, start_date) values (uC, 'Netflix HD', 2300, tdy + 9) returning id into rD2;
  insert into public.reminders (user_id, name, amount, start_date) values (uC, 'Netflix Gyerek', 999, tdy + 9);
  perform public.compute_tips(uC);
  select count(*) into n from public.tips where user_id = uC and code = 'duplicate_reminder'; assert n = 1, 'duplikátumok: ' || n;

  -- ── 7) késedelmes fizetés-minta ──
  insert into public.reminders (user_id, name, amount, start_date) values (uC, 'Rezsi', 15000, date '2020-01-01') returning id into rL;
  delete from public.occurrences where reminder_id = rL;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at) values
    (rL, uC, tdy - 90, 15000, 'HUF', 'paid', tdy - 87, now()), (rL, uC, tdy - 60, 15000, 'HUF', 'paid', tdy - 60, now()),
    (rL, uC, tdy - 30, 15000, 'HUF', 'paid', tdy - 27, now());
  perform public.compute_tips(uC);
  select * into t from public.tips where user_id = uC and code = 'late_payment_pattern'; assert (t.params ->> 'count')::int = 2, 'késés: ' || coalesce(t::text, 'NULL');

  -- ── 8) használat-ellenőrzés ──
  update public.reminders set created_at = now() - interval '40 days' where id = rS;
  perform public.compute_tips(uC);
  select count(*) into n from public.tips where user_id = uC and code = 'unused_check' and reminder_ids = array[rS]; assert n = 1, 'használat-kérdés hiányzik';
  perform set_config('request.jwt.claims', json_build_object('sub', uC, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.answer_usage_check(rS, false);
  reset role;
  select count(*) into n from public.tips where user_id = uC and code = 'unused_check' and reminder_ids = array[rS] and status in ('new', 'seen'); assert n = 0, 'a kérdés nem zárult le';
  update public.usage_checks set answered_at = now() - interval '100 days' where reminder_id = rS;               -- az első válasz régi
  set local role authenticated; perform public.answer_usage_check(rS, false); reset role;                         -- a második „nem"
  select * into t from public.tips where user_id = uC and code = 'sub_unused';
  assert t.reminder_ids = array[rS] and t.est_monthly_saving is not null and t.severity = 'save', '2× nem után nincs lemondási tipp: ' || coalesce(t::text, 'NULL');

  -- ── 9) keret ──
  insert into public.budgets (user_id, category_id, monthly_limit) values (uC, cShop, 1000);
  insert into public.expenses (user_id, category_id, amount, spent_on) values (uC, cShop, 1500, tdy);
  perform public.compute_tips(uC);
  select count(*) into n from public.tips where user_id = uC and code = 'budget_over_now'; assert n = 1, 'keret-túllépés tipp: ' || n;

  -- ── 10) kikapcsolt tippek ──
  update public.profiles set tips_enabled = false where id = uC;
  perform public.compute_tips(uC);
  select count(*) into n from public.tips where user_id = uC and status in ('new', 'seen'); assert n = 0, 'kikapcsolt tippek mellett maradt tipp: ' || n;

  raise notice 'A-21 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

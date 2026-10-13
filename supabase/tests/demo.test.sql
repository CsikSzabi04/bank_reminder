-- A-30: minta-adatok betöltése/törlése, idempotencia, elkülönítés.
do $$
declare uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); n int; j jsonb; ok boolean;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (uB, 'authenticated', 'authenticated', 'b@example.test', '{}');
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.load_demo_data() = 11, 'demó betöltés';
  assert public.load_demo_data() = 0, 'nem üres fiókba is betöltött';
  select count(*) into n from public.reminders where is_demo; assert n = 11, 'demó emlékeztetők: ' || n;
  select count(*) into n from public.occurrences where status = 'paid'; assert n >= 30, 'előzmény hiányzik: ' || n;
  j := public.dashboard_summary(public.month_start(public.user_today() - 30));    -- múlt hónap: kifizetett számlák + kiadások
  assert (j #>> '{hero,paid}')::numeric > 150000, 'a múlt havi összeg túl kicsi: ' || (j #>> '{hero,paid}');
  assert jsonb_array_length(j -> 'groups') >= 4, 'csoportok';
  select count(*) into n from public.analytics_subscriptions(); assert n >= 5, 'előfizetések: ' || n;
  reset role;
  select count(*) into n from public.notifications where user_id = uA and kind = 'reminder'; assert n > 0, 'a demó emlékeztetőkhöz nem épült értesítési sor';
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.clear_demo_data() = 0, 'B törölte A demó-adatát';
  reset role;
  select count(*) into n from public.reminders where user_id = uA; assert n = 11, 'A adata sérült';
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.clear_demo_data() = 11, 'demó törlés';
  select count(*) into n from public.reminders; assert n = 0, 'maradt emlékeztető';
  select count(*) into n from public.expenses; assert n = 0, 'maradt demó-kiadás';
  reset role;
  select count(*) into n from public.occurrences where user_id = uA; assert n = 0, 'maradt esedékesség';
  select count(*) into n from public.notifications where user_id = uA; assert n = 0, 'maradt értesítés';
  set local role anon;
  ok := false; begin perform public.load_demo_data(); exception when insufficient_privilege then ok := true; end; assert ok, 'anon betöltheti a demót';
  reset role;
  raise notice 'A-30 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

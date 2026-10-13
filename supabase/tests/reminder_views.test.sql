-- A-31: v_reminders + reminder_history (árváltozás-jelzés, elkülönítés).
do $$
declare uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid(); tdy date := (now() at time zone 'Europe/Budapest')::date; r uuid; rr record; n int;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (uB, 'authenticated', 'authenticated', 'b@example.test', '{}');
  insert into public.reminders (user_id, name, amount, is_subscription, recur_unit, start_date) values (uA, 'Spotify', 2300, true, 'month', tdy - 90) returning id into r;
  delete from public.occurrences where reminder_id = r;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status, paid_on, paid_at) values
    (r, uA, tdy - 60, 2000, 'HUF', 'paid', tdy - 60, now()), (r, uA, tdy - 30, 2000, 'HUF', 'paid', tdy - 29, now());
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency, status) values (r, uA, tdy - 2, 2300, 'HUF', 'upcoming'), (r, uA, tdy + 28, 2300, 'HUF', 'upcoming');
  insert into public.reminders (user_id, name, amount, start_date) values (uB, 'Más', 1, tdy + 5);

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select * into rr from public.v_reminders where id = r;
  assert rr.next_due = tdy - 2 and rr.next_overdue and rr.next_amount = 2300, 'next_due/overdue: ' || rr.next_due || ' ' || rr.next_overdue;
  assert rr.last_paid_on = tdy - 29, 'last_paid_on: ' || coalesce(rr.last_paid_on::text, 'NULL');
  assert rr.monthly_base = 2300, 'monthly_base: ' || coalesce(rr.monthly_base::text, 'NULL');
  select count(*) into n from public.v_reminders; assert n = 1, 'A csak a sajátját látja: ' || n;

  select count(*) into n from public.reminder_history(r); assert n = 4, 'előzmény sorok: ' || n;
  select * into rr from public.reminder_history(r) limit 1; assert rr.due_date = tdy + 28, 'rendezés: legfrissebb elöl';
  select * into rr from public.reminder_history(r) where due_date = tdy - 2;
  assert rr.prev_amount = 2000 and rr.change_pct = 15.0 and rr.overdue, 'árváltozás: ' || rr.change_pct;
  select * into rr from public.reminder_history(r) where due_date = tdy + 28; assert rr.change_pct = 0.0, 'változatlan ár: ' || rr.change_pct;
  select * into rr from public.reminder_history(r) where due_date = tdy - 60; assert rr.change_pct is null and rr.prev_amount is null, 'az első sornak nincs előzménye';

  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  select count(*) into n from public.reminder_history(r); assert n = 0, 'B látja A előzményét';
  select count(*) into n from public.v_reminders where id = r; assert n = 0, 'B látja A emlékeztetőjét';
  reset role;
  raise notice 'A-31 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

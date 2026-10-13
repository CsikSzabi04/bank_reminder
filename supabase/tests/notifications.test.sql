-- A-12/A-13: értesítési sor, DST-vektorok, claim/finish, kapcsolók, snooze, push-regisztráció, ICS, export.
-- Futtatás: tranzakcióban, ROLLBACK-kel; a "most" a hívásokban fix (p_now), ahol a dátum számít.
do $$
declare
  uA uuid := gen_random_uuid(); uB uuid := gen_random_uuid();
  tdy date := (now() at time zone 'Europe/Budapest')::date;
  r uuid; r2 uuid; occ uuid; occ2 uuid; sub uuid; ts timestamptz; n int; v int; ok boolean; j jsonb; row_ record; tok text; tok2 text;
  vec record;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (uB, 'authenticated', 'authenticated', 'b@example.test', '{}');

  -- ── T1: DST-vektorok (ARCHITECTURE.md §8.4) ──
  for vec in select * from (values
      (date '2026-11-10', timestamptz '2026-11-05 10:00+00', timestamptz '2026-11-09 08:00+00'),
      (date '2026-10-25', timestamptz '2026-10-20 10:00+00', timestamptz '2026-10-24 07:00+00'),
      (date '2026-10-26', timestamptz '2026-10-20 10:00+00', timestamptz '2026-10-25 08:00+00'),
      (date '2026-03-29', timestamptz '2026-03-25 10:00+00', timestamptz '2026-03-28 08:00+00'),
      (date '2026-03-30', timestamptz '2026-03-25 10:00+00', timestamptz '2026-03-29 07:00+00')) t(due, pnow, expected) loop
    insert into public.reminders (user_id, name, amount, start_date) values (uA, 'DST ' || vec.due, 1000, vec.due) returning id into r;
    perform public.ensure_occurrences(r, 120, vec.pnow);
    perform public.rebuild_notification_queue(r, vec.pnow);
    select scheduled_for into ts from public.notifications where reminder_id = r and channel = 'push' and kind = 'reminder';
    assert ts = vec.expected, format('DST %s: %s (várt %s)', vec.due, ts, vec.expected);
    select count(*) into n from public.notifications where reminder_id = r; assert n = 2, 'in_app + push sor várt: ' || n;
    select status into row_ from public.notifications where reminder_id = r and channel = 'in_app'; assert row_.status = 'sent', 'in_app status';
  end loop;
  delete from public.reminders where user_id = uA;   -- takarítás (kaszkád)

  -- ── T2: idempotencia, csatornák, stale ──
  insert into public.reminders (user_id, name, amount, start_date, channels) values (uA, 'Fut', 2000, tdy + 10, '{push,email}') returning id into r;
  select count(*) into n from public.notifications where reminder_id = r; assert n = 2, 'email nélkül in_app+push: ' || n;   -- profil: email ki
  perform public.rebuild_notification_queue(r); perform public.rebuild_notification_queue(r);
  select count(*) into v from public.notifications where reminder_id = r; assert v = n, 'nem idempotens: ' || v;
  update public.profiles set channel_email = true where id = uA;                                                            -- trigger: újraépítés
  select count(*) into n from public.notifications where reminder_id = r; assert n = 3, 'email csatorna nem épült: ' || n;
  update public.profiles set channel_email = false where id = uA;
  select count(*) into n from public.notifications where reminder_id = r and channel = 'email'; assert n = 0, 'email sor maradt';
  -- 24 óránál régebbi értesítés nem épül
  insert into public.reminders (user_id, name, amount, start_date) values (uA, 'Régi', 1, date '2026-03-30') returning id into r2;
  perform public.ensure_occurrences(r2, 120, timestamptz '2026-03-30 20:00+00');       -- a lejárat napja este
  perform public.rebuild_notification_queue(r2, timestamptz '2026-03-30 20:00+00');    -- a 29-i 07:00Z sor 37 órás → nem épül
  select count(*) into n from public.notifications where reminder_id = r2 and channel = 'push'; assert n = 0, 'elavult sor épült: ' || n;
  delete from public.reminders where id = r2;

  -- ── T3: mark_paid / unpaid ──
  select id into occ from public.occurrences where reminder_id = r order by due_date limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.mark_paid(occ);
  reset role;
  select count(*) into n from public.notifications where occurrence_id = occ and status = 'cancelled'; assert n = 2, 'paid után nem törlődtek: ' || n;
  set local role authenticated;
  perform public.mark_unpaid(occ);
  reset role;
  select count(*) into n from public.notifications where occurrence_id = occ and channel = 'push' and status = 'pending'; assert n = 1, 'unpaid után nem épült újra: ' || n;
  select count(*) into n from public.notifications where occurrence_id = occ and status = 'cancelled'; assert n = 0, 'cancelled sor maradt';

  -- ── T4: kapcsolók ──
  update public.reminders set remind_enabled = false where id = r;
  select count(*) into n from public.notifications where reminder_id = r; assert n = 0, 'remind_enabled=false után maradt sor: ' || n;
  update public.reminders set remind_enabled = true where id = r;
  select count(*) into n from public.notifications where reminder_id = r; assert n = 2, 'visszakapcsolás után nem épült: ' || n;
  update public.profiles set reminders_enabled = false where id = uA;
  select count(*) into n from public.notifications where reminder_id = r; assert n = 0, 'globális kikapcsolás után maradt sor: ' || n;
  update public.profiles set reminders_enabled = true where id = uA;
  select count(*) into n from public.notifications where reminder_id = r; assert n = 2, 'globális visszakapcsolás nem épített: ' || n;
  update public.reminders set remind_offsets = '{0,2}' where id = r;
  select count(*) into n from public.notifications where reminder_id = r; assert n = 4, 'két offset × 2 csatorna = 4 várt: ' || n;

  -- ── T5: claim / finish / retry / lejárat / kapcsolók a küldéskor ──
  delete from public.notifications where user_id in (uA, uB);
  update public.reminders set remind_offsets = '{1}' where id = r;
  select scheduled_for into ts from public.notifications where reminder_id = r and channel = 'push';
  select count(*) into n from public.claim_due_notifications(100, ts - interval '1 minute'); assert n = 0, 'korán claim-elt';
  select * into row_ from public.claim_due_notifications(100, ts + interval '1 minute');
  assert row_.status = 'sending' and row_.attempts = 1 and row_.channel = 'push', 'claim hibás';
  select count(*) into n from public.claim_due_notifications(100, ts + interval '1 minute'); assert n = 0, 'dupla claim';
  perform public.finish_notification(row_.id, 'retry', 'timeout', ts + interval '1 minute');
  select count(*) into n from public.claim_due_notifications(100, ts + interval '2 minutes'); assert n = 0, 'backoff előtt újra claim';
  select * into row_ from public.claim_due_notifications(100, ts + interval '4 minutes'); assert row_.attempts = 2, 'retry claim: ' || coalesce(row_.attempts::text, 'NULL');
  perform public.finish_notification(row_.id, 'retry', 'x', ts + interval '4 minutes');
  select * into row_ from public.claim_due_notifications(100, ts + interval '10 minutes'); assert row_.attempts = 3, 'attempt 3';
  perform public.finish_notification(row_.id, 'retry', 'x', ts + interval '10 minutes');
  select * into row_ from public.claim_due_notifications(100, ts + interval '30 minutes'); assert row_.attempts = 4, 'attempt 4';
  perform public.finish_notification(row_.id, 'retry', 'x', ts + interval '30 minutes');
  select * into row_ from public.claim_due_notifications(100, ts + interval '90 minutes'); assert row_.attempts = 5, 'attempt 5';
  perform public.finish_notification(row_.id, 'retry', 'x', ts + interval '90 minutes');
  select count(*) into n from public.claim_due_notifications(100, ts + interval '10 hours'); assert n = 0, 'az 5. próba után is claim-elhető';
  select status, next_attempt_at into row_ from public.notifications where id = row_.id;
  assert row_.status = 'failed' and row_.next_attempt_at is null, 'végleges hiba állapota: ' || row_.status;

  -- sikeres küldés
  delete from public.notifications where user_id = uA;
  perform public.rebuild_notification_queue(r);
  select scheduled_for into ts from public.notifications where reminder_id = r and channel = 'push' and status = 'pending';
  select * into row_ from public.claim_due_notifications(100, ts + interval '1 minute');
  perform public.finish_notification(row_.id, 'sent', null, ts + interval '1 minute');
  select status, sent_at into row_ from public.notifications where id = row_.id; assert row_.status = 'sent' and row_.sent_at is not null, 'sent állapot';

  -- 24 óránál elavultabb sor lejár, nem megy ki
  delete from public.notifications where user_id = uA;
  insert into public.notifications (user_id, kind, channel, payload, scheduled_for, dedupe_key) values (uA, 'system', 'push', '{}', now() - interval '30 hours', 'test:stale');
  select count(*) into n from public.claim_due_notifications(100); assert n = 0, 'elavult sor kiment';
  select status into row_ from public.notifications where dedupe_key = 'test:stale'; assert row_.status = 'expired', 'elavult sor státusza: ' || row_.status;

  -- kapcsolók a KÜLDÉS pillanatában + kifizetett esedékesség
  insert into public.notifications (user_id, kind, channel, payload, scheduled_for, dedupe_key) values (uA, 'system', 'push', '{}', now() - interval '1 minute', 'test:switch');
  update public.profiles set reminders_enabled = false where id = uA;
  select count(*) into n from public.claim_due_notifications(100); assert n = 0, 'kikapcsolt profilnak claim';
  select status into row_ from public.notifications where dedupe_key = 'test:switch'; assert row_.status = 'cancelled', 'switch: ' || row_.status;
  update public.profiles set reminders_enabled = true where id = uA;
  select id into occ2 from public.occurrences where reminder_id = r order by due_date limit 1;
  update public.occurrences set status = 'paid', paid_at = now(), paid_on = tdy where id = occ2;
  insert into public.notifications (user_id, kind, channel, reminder_id, occurrence_id, payload, scheduled_for, dedupe_key)
    values (uA, 'reminder', 'push', r, occ2, '{}', now() - interval '1 minute', 'test:paid');
  select count(*) into n from public.claim_due_notifications(100); assert n = 0, 'kifizetett tételre claim';
  select status into row_ from public.notifications where dedupe_key = 'test:paid'; assert row_.status = 'cancelled', 'paid: ' || row_.status;
  update public.occurrences set status = 'upcoming', paid_at = null, paid_on = null where id = occ2;

  -- ── T6: push eszköz-eredmény ──
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values (uA, 'https://fcm.googleapis.com/fcm/send/r1', 'k', 'a') returning id into sub;
  perform public.record_push_result(sub, 201); select last_success_at is not null into ok from public.push_subscriptions where id = sub;
  assert ok, '201 nem frissített';
  perform public.record_push_result(sub, 429); perform public.record_push_result(sub, 503); perform public.record_push_result(sub, 0);
  select failed_count into n from public.push_subscriptions where id = sub; assert n = 0, 'átmeneti hiba büntette az eszközt';
  for v in 1..5 loop perform public.record_push_result(sub, 400); end loop;
  select disabled_at is not null into ok from public.push_subscriptions where id = sub; assert ok, '5× 400 után nincs letiltva';
  update public.push_subscriptions set disabled_at = null, failed_count = 0 where id = sub;
  perform public.record_push_result(sub, 410);
  select disabled_at is not null into ok from public.push_subscriptions where id = sub; assert ok, '410 nem tiltotta le';

  -- ── T7: snooze ──
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.snooze_occurrence(occ2, now() + interval '2 hours'); exception when sqlstate 'P0002' then ok := true; end;
  assert ok, 'B halaszthatja A tételét';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.snooze_occurrence(occ2, now() - interval '1 hour'); exception when sqlstate '22023' then ok := true; end;
  assert ok, 'múltbeli snooze elfogadva';
  perform public.snooze_occurrence(occ2, now() + interval '3 hours');
  reset role;
  select count(*) into n from public.notifications where occurrence_id = occ2 and dedupe_key like 'snz:%' and channel in ('push', 'in_app'); assert n = 2, 'snooze sorok: ' || n;
  set local role authenticated;
  perform public.snooze_occurrence(occ2);       -- alap: holnap remind_time-kor
  select snoozed_until > now() into ok from public.occurrences where id = occ2; assert ok, 'alap snooze nincs a jövőben';
  reset role;
  update public.occurrences set status = 'paid', paid_at = now(), paid_on = tdy where id = occ2;
  set local role authenticated;
  ok := false; begin perform public.snooze_occurrence(occ2, now() + interval '1 hour'); exception when sqlstate '22023' then ok := true; end;
  assert ok, 'kifizetett tétel halasztható';
  reset role;
  update public.occurrences set status = 'upcoming', paid_at = null, paid_on = null where id = occ2;

  -- ── T8: extra sorok: lejárt, próbaidő, digest ──
  delete from public.notifications where user_id = uA;
  insert into public.reminders (user_id, name, amount, start_date, trial_ends_on) values (uA, 'Régi tétel', 500, date '2026-09-01', date '2026-09-10') returning id into r2;
  delete from public.occurrences where reminder_id = r2;
  insert into public.occurrences (reminder_id, user_id, due_date, amount, currency) values (r2, uA, date '2026-09-01', 500, 'HUF'), (r2, uA, date '2026-09-15', 500, 'HUF');
  n := public.enqueue_extra_notifications(timestamptz '2026-09-02 07:30+00');            -- 09:30 helyi, a lejárat +1. napja
  select count(*) into v from public.notifications where user_id = uA and kind = 'overdue' and (payload ->> 'k')::int = 1; assert v = 2, 'overdue k=1 sorok (in_app+push): ' || v;
  select count(*) into v from public.notifications where user_id = uA and kind = 'overdue' and (payload ->> 'k')::int = 2; assert v = 0, 'overdue k=2 korán épült';
  n := public.enqueue_extra_notifications(timestamptz '2026-09-02 07:30+00');
  select count(*) into v from public.notifications where user_id = uA and kind = 'overdue'; assert v = 2, 'overdue nem idempotens: ' || v;
  n := public.enqueue_extra_notifications(timestamptz '2026-09-09 08:00+00');            -- próba vége előtti nap 10:00 helyi
  select count(*) into v from public.notifications where user_id = uA and kind = 'trial_end'; assert v = 2, 'trial_end sorok: ' || v;
  n := public.enqueue_extra_notifications(timestamptz '2026-09-13 16:30+00');            -- vasárnap 18:30 helyi
  select count(*) into v from public.notifications where user_id = uA and kind = 'digest'; assert v = 2, 'digest sorok: ' || v;
  select payload into j from public.notifications where user_id = uA and kind = 'digest' and channel = 'push';
  assert (j ->> 'count')::int = 1 and jsonb_array_length(j -> 'items') = 1, 'digest tartalma: ' || j::text;
  delete from public.notifications where user_id = uA and kind = 'digest';
  n := public.enqueue_extra_notifications(timestamptz '2026-09-12 16:30+00');            -- szombat → nincs digest
  select count(*) into v from public.notifications where user_id = uA and kind = 'digest'; assert v = 0, 'digest nem vasárnap';
  update public.occurrences set status = 'paid', paid_at = now(), paid_on = date '2026-09-01' where reminder_id = r2 and due_date = date '2026-09-01';
  delete from public.notifications where user_id = uA and kind = 'overdue';
  n := public.enqueue_extra_notifications(timestamptz '2026-09-02 07:30+00');
  select count(*) into v from public.notifications where user_id = uA and kind = 'overdue'; assert v = 0, 'kifizetett tételre overdue épült';

  -- ── T9: push-regisztráció ──
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.register_push_subscription('https://web.push.apple.com/abc', 'k', 'a', 'ios', 'UA', 'iPhone');
  ok := false; begin perform public.register_push_subscription('https://evil.example.com/x', 'k', 'a'); exception when check_violation then ok := true; end;
  assert ok, 'tiltott push host elfogadva';
  ok := false; begin perform public.register_push_subscription('http://fcm.googleapis.com/x', 'k', 'a'); exception when check_violation then ok := true; end;
  assert ok, 'http endpoint elfogadva';
  ok := false; begin execute 'insert into public.push_subscriptions (endpoint, p256dh, auth) values (''https://fcm.googleapis.com/z'', ''k'', ''a'')'; exception when insufficient_privilege then ok := true; end;
  assert ok, 'közvetlen push insert engedett';
  for v in 1..9 loop perform public.register_push_subscription('https://fcm.googleapis.com/fcm/send/d' || v, 'k', 'a'); end loop;   -- 1 apple + 9 = 10
  ok := false; begin perform public.register_push_subscription('https://fcm.googleapis.com/fcm/send/d11', 'k', 'a'); exception when sqlstate '53400' then ok := true; end;
  assert ok, '11. eszköz elfogadva';
  perform public.register_push_subscription('https://fcm.googleapis.com/fcm/send/d1', 'k2', 'a2');   -- meglévő endpoint frissítése nem számít új eszköznek
  reset role;
  -- eszköz-átvétel másik felhasználóra
  perform set_config('request.jwt.claims', json_build_object('sub', uB, 'role', 'authenticated')::text, true);
  set local role authenticated;
  perform public.register_push_subscription('https://web.push.apple.com/abc', 'kB', 'aB', 'ios');
  select count(*) into n from public.push_subscriptions; assert n = 1, 'B eszközei: ' || n;
  ok := public.unregister_push_subscription('https://fcm.googleapis.com/fcm/send/d1'); assert not ok, 'B törölhette A eszközét';
  reset role;
  select user_id = uB into ok from public.push_subscriptions where endpoint = 'https://web.push.apple.com/abc'; assert ok, 'az eszköz nem került B-hez';
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := public.unregister_push_subscription('https://fcm.googleapis.com/fcm/send/d1'); assert ok, 'A nem törölheti a saját eszközét';
  reset role;

  -- ── T10: olvasottság ──
  delete from public.notifications where user_id in (uA, uB);
  insert into public.notifications (user_id, kind, channel, payload, scheduled_for, status, dedupe_key) values
    (uA, 'system', 'in_app', '{}', now() - interval '1 hour', 'sent', 'rd:1'), (uA, 'system', 'in_app', '{}', now() - interval '2 hour', 'sent', 'rd:2'),
    (uA, 'system', 'in_app', '{}', now() + interval '1 hour', 'sent', 'rd:3'),  (uA, 'system', 'in_app', '{}', now() - interval '1 hour', 'cancelled', 'rd:4'),
    (uB, 'system', 'in_app', '{}', now() - interval '1 hour', 'sent', 'rd:5');
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  assert public.unread_notifications() = 2, 'olvasatlan: ' || public.unread_notifications();     -- a jövőbeli és a törölt nem számít
  assert public.mark_notifications_read() = 2, 'mark read db';
  assert public.unread_notifications() = 0, 'olvasatlan marad';
  reset role;
  select count(*) into n from public.notifications where user_id = uB and read_at is not null; assert n = 0, 'B értesítése olvasottra váltott';

  -- ── T11/T12: export + ICS ──
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  j := public.export_my_data();
  assert jsonb_array_length(j -> 'reminders') >= 1 and not (j -> 'profile' ? 'ics_token'), 'export tartalma';
  assert not (j::text like '%p256dh%'), 'az export push-kulcsot tartalmaz';
  reset role;
  select ics_token into tok from public.profiles where id = uA;
  set local role anon;
  select count(*) into n from public.ics_feed(tok); assert n >= 1, 'ICS feed üres';
  select count(*) into n from public.ics_feed(tok || 'x'); assert n = 0, 'rossz token ad adatot';
  select count(*) into n from public.ics_feed('rovid'); assert n = 0, 'rövid token ad adatot';
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  tok2 := public.rotate_ics_token(); assert tok2 <> tok and length(tok2) >= 32, 'token-forgatás';
  reset role;
  set local role anon;
  select count(*) into n from public.ics_feed(tok); assert n = 0, 'a régi token él';
  select count(*) into n from public.ics_feed(tok2); assert n >= 1, 'az új token nem él';
  reset role;

  -- ── T13: háttér-függvények klienstől nem hívhatók ──
  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;
  ok := false; begin perform public.claim_due_notifications(); exception when insufficient_privilege then ok := true; end; assert ok, 'claim hívható klienstől';
  ok := false; begin perform public.enqueue_extra_notifications(); exception when insufficient_privilege then ok := true; end; assert ok, 'enqueue_extra hívható klienstől';
  ok := false; begin perform public.rebuild_notification_queue(r); exception when insufficient_privilege then ok := true; end; assert ok, 'rebuild hívható klienstől';
  ok := false; begin perform public.run_daily_maintenance(); exception when insufficient_privilege then ok := true; end; assert ok, 'run_daily_maintenance hívható klienstől';
  reset role;

  raise notice 'A-12/13 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

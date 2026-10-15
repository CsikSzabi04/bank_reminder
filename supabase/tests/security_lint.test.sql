-- A-29: automata biztonsági ellenőrzés (jogosultságok, nézetek, anon-felület, Storage-policyk). Tranzakcióban, ROLLBACK-kel.
do $$
declare n int; names text;
begin
  select count(*) into n from information_schema.role_table_grants where grantee = 'anon' and table_schema = 'public';
  assert n = 0, 'anon-nak table-jogosultsága van a public sémában: ' || n;
  select count(*) into n from information_schema.role_table_grants where grantee = 'authenticated' and table_schema = 'public' and privilege_type in ('TRUNCATE', 'TRIGGER', 'REFERENCES');
  assert n = 0, 'authenticated-nek felesleges TRUNCATE/TRIGGER/REFERENCES joga van: ' || n;

  select string_agg(relname, ', ') into names from pg_class c join pg_namespace ns on ns.oid = c.relnamespace
   where ns.nspname = 'public' and c.relkind = 'v' and not coalesce(c.reloptions, '{}') @> array['security_invoker=true'];
  assert names is null, 'nem security_invoker nézet(ek): ' || names;

  select string_agg(p.proname, ', ' order by p.proname) into names from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') and p.proname not in ('ics_feed', 'is_valid_timezone', 'set_updated_at');
  assert names is null, 'anon által hívható, nem engedélyezett függvény(ek): ' || names;

  select count(*) into n from pg_policies where schemaname = 'storage' and policyname like 'avatars_%'; assert n = 3, 'avatars policyk: ' || n;
  select count(*) into n from storage.buckets where id = 'avatars' and file_size_limit = 2097152 and 'image/svg+xml' <> all (allowed_mime_types);
  assert n = 1, 'az avatars bucket korlátai nem a vártak (2 MB, SVG tiltva)';

  select count(*) into n from pg_extension e join pg_namespace ns on ns.oid = e.extnamespace where e.extname in ('pg_net') and ns.nspname = 'public';
  assert n = 0, 'pg_net a public sémában van';

  -- service_role-only háttér-függvények: sem anon, sem authenticated nem hívhatja
  select string_agg(p.proname, ', ') into names from pg_proc p join pg_namespace ns on ns.oid = p.pronamespace
   where ns.nspname = 'public' and p.proname in ('claim_due_notifications', 'finish_notification', 'record_push_result', 'enqueue_extra_notifications', 'run_daily_maintenance',
         'rebuild_notification_queue', 'rebuild_notification_queue_all', 'compute_tips', 'refresh_tips_all', 'ensure_occurrences', 'ensure_occurrences_all', 'process_auto_paid',
         'call_edge_function', 'cleanup_old_data', 'ops_health', 'handle_new_user', 'budget_status_for', 'cancel_occurrence_notifications', 'tip_cfg', 'expenses_tombstone', 'expenses_guard_flags', 'check_budget_alert', 'expenses_budget_alert', 'start_bank_connect', 'consume_bank_connect_state', 'finish_bank_connection', 'revoke_bank_connection', 'match_merchant_category')
     and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'));
  assert names is null, 'klienstől hívható háttér-függvény(ek): ' || names;

  assert (public.ops_health() ->> 'generated_at') is not null, 'ops_health nem fut';
  raise notice 'A-29 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

-- A-18 (1/2): pg_cron + pg_net, Edge Function-hívó segéd (titok a Vaultból), SQL-only ütemezések, takarítás.
-- A HTTP-alapú jobok (send_notifications, fx_refresh, news_ingest) külön migrációban jönnek, a függvények telepítése UTÁN.
-- A `cron_secret` Vault-bejegyzést a scripts/setup-secrets.mjs hozza létre (érték soha nincs migrációban/fájlban — H3).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Edge Function hívása az ütemezőből: x-cron-secret fejléc a Vaultból; ha nincs titok, nem hív (és figyelmeztet)
create or replace function public.call_edge_function(p_name text) returns bigint
language plpgsql security definer set search_path = '' as $$
declare secret text; req bigint;
begin
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  if secret is null then raise warning 'cron_secret hiányzik a Vaultból — %: kihagyva', p_name; return null; end if;
  select net.http_post(
           url := 'https://ddvzslgwexvdolovqqlg.supabase.co/functions/v1/' || p_name,
           headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret),
           body := '{}'::jsonb, timeout_milliseconds := 25000) into req;
  return req;
end $$;
revoke execute on function public.call_edge_function(text) from public, anon, authenticated;

-- napi takarítás (megőrzés: ARCHITECTURE.md §9.4)
create or replace function public.cleanup_old_data() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare a int; b int; c int; d int := 0;
begin
  delete from public.notifications where scheduled_for < now() - interval '90 days' and status in ('sent', 'expired', 'cancelled', 'failed');
  get diagnostics a = row_count;
  delete from public.news_items where expires_at < now() - interval '60 days';
  get diagnostics b = row_count;
  delete from public.push_subscriptions where disabled_at < now() - interval '30 days';
  get diagnostics c = row_count;
  begin
    delete from cron.job_run_details where end_time < now() - interval '7 days';
    get diagnostics d = row_count;
  exception when others then d := -1;   -- jogosultság hiánya ne akassza meg a többit
  end;
  return jsonb_build_object('notifications', a, 'news_items', b, 'push_subscriptions', c, 'cron_runs', d);
end $$;
revoke execute on function public.cleanup_old_data() from public, anon, authenticated;
grant execute on function public.cleanup_old_data() to service_role;

-- ütemezések (UTC). Idempotens: előbb leveszi a korábbi azonos nevűt.
do $$
declare j text;
begin
  foreach j in array array['occurrences_daily', 'enqueue_extras', 'cleanup_daily'] loop
    if exists (select 1 from cron.job where jobname = j) then perform cron.unschedule(j); end if;
  end loop;
end $$;

select cron.schedule('occurrences_daily', '15 2 * * *',   $$select public.run_daily_maintenance()$$);
select cron.schedule('enqueue_extras',    '*/5 * * * *',  $$select public.enqueue_extra_notifications()$$);
select cron.schedule('cleanup_daily',     '0 4 * * *',    $$select public.cleanup_old_data()$$);

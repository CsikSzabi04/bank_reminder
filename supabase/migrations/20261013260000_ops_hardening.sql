-- A-26/A-29: szigorítás + üzemeltetési nézet.
-- 1) A kliens-szerepköröknek nincs szükségük TRUNCATE/TRIGGER/REFERENCES jogra (a Supabase alapértelmezés mindet megadja).
revoke truncate, trigger, references on all tables in schema public from authenticated, anon;
alter default privileges in schema public revoke truncate, trigger, references on tables from authenticated, anon;

-- 2) pg_net ne a public sémában éljen (extension_in_public lint): újratelepítés az `extensions` sémába (a függvények a `net` sémát hívják)
do $$
begin
  if exists (select 1 from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_net' and n.nspname = 'public') then
    drop extension pg_net;
    create extension pg_net with schema extensions;
  end if;
end $$;

-- 3) üzemeltetési összkép (csak service_role / DB-admin): cron-futások, sor-állapotok, eszközök, hírforrások, árfolyam
create or replace function public.ops_health() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  return jsonb_build_object(
    'generated_at', now(),
    'notifications', (select jsonb_build_object(
        'due_pending',   count(*) filter (where channel in ('push', 'email') and status = 'pending' and scheduled_for <= now() - interval '5 minutes'),
        'stuck_sending', count(*) filter (where status = 'sending' and claimed_at < now() - interval '10 minutes'),
        'failed_24h',    count(*) filter (where status = 'failed'  and created_at > now() - interval '24 hours'),
        'sent_24h',      count(*) filter (where status = 'sent' and channel <> 'in_app' and sent_at > now() - interval '24 hours'),
        'expired_24h',   count(*) filter (where status = 'expired' and scheduled_for > now() - interval '24 hours'))
      from public.notifications),
    'push', (select jsonb_build_object('active', count(*) filter (where disabled_at is null), 'disabled', count(*) filter (where disabled_at is not null))
               from public.push_subscriptions),
    'cron', coalesce((select jsonb_agg(jsonb_build_object('job', x.jobname, 'last_run', x.start_time, 'status', x.status, 'message', left(x.return_message, 120)) order by x.jobname)
        from (select distinct on (j.jobname) j.jobname, d.start_time, d.status, d.return_message
                from cron.job j left join cron.job_run_details d on d.jobid = j.jobid
               order by j.jobname, d.start_time desc nulls last) x), '[]'::jsonb),
    'news', coalesce((select jsonb_agg(jsonb_build_object('source', key, 'enabled', enabled, 'last_status', last_status, 'last_fetched_at', last_fetched_at, 'last_error', last_error) order by key)
                        from public.news_sources), '[]'::jsonb),
    'news_items_visible', (select count(*) from public.news_items where not is_hidden and expires_at > now()),
    'fx_latest', (select max(as_of) from public.fx_rates)
  );
end $$;
revoke execute on function public.ops_health() from public, anon, authenticated;
grant execute on function public.ops_health() to service_role;

-- A-18: takarítás + Edge-hívó segéd + ütemezések megléte. Tranzakcióban, ROLLBACK-kel.
do $$
declare uA uuid := gen_random_uuid(); r jsonb; n int; has_secret boolean; res bigint;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values (uA, 'authenticated', 'authenticated', 'c@example.test', '{}');
  insert into public.notifications (user_id, kind, channel, payload, scheduled_for, status, dedupe_key) values
    (uA, 'system', 'push', '{}', now() - interval '100 days', 'sent', 'cl:old'),
    (uA, 'system', 'push', '{}', now() - interval '100 days', 'pending', 'cl:oldpending'),
    (uA, 'system', 'push', '{}', now() - interval '1 day', 'sent', 'cl:new');
  insert into public.news_sources (key, name, feed_url, home_url) values ('cl-src', 'T', 'https://x.test/rss', 'https://x.test');
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values
    ('cl-src', 'https://x.test/old', 'o', 'general', now() - interval '90 days', now() - interval '70 days'),
    ('cl-src', 'https://x.test/new', 'n', 'general', now(), now() + interval '1 day');
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, disabled_at) values
    (uA, 'https://fcm.googleapis.com/fcm/send/cl1', 'k', 'a', now() - interval '40 days'),
    (uA, 'https://fcm.googleapis.com/fcm/send/cl2', 'k', 'a', now() - interval '2 days');
  r := public.cleanup_old_data();
  assert (r ->> 'notifications')::int = 1, 'notifications törlés: ' || r::text;      -- csak a régi, lezárt; a pending marad
  assert (r ->> 'news_items')::int = 1 and (r ->> 'push_subscriptions')::int = 1, 'takarítás: ' || r::text;
  select count(*) into n from public.notifications where user_id = uA; assert n = 2, 'maradék értesítések: ' || n;

  select exists (select 1 from vault.decrypted_secrets where name = 'cron_secret') into has_secret;
  if not has_secret then
    res := public.call_edge_function('send-notifications'); assert res is null, 'titok nélkül nem hívhat';
  end if;

  select count(*) into n from cron.job where jobname in ('occurrences_daily', 'enqueue_extras', 'cleanup_daily'); assert n = 3, 'cron jobok: ' || n;
  raise notice 'A-18 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

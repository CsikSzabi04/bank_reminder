-- elszigetelés: az élő adatoktól független (a tranzakció visszagörgetődik)
delete from public.news_items; delete from public.news_sources;
-- A-25: news_feed / news_get (frissesség, lejárat, rejtés, kikapcsolt forrás, lapozás), jelentés-alapú automatikus elrejtés, hozzáférés-védelem.
do $$
declare
  uA uuid := gen_random_uuid(); u2 uuid := gen_random_uuid(); u3 uuid := gen_random_uuid();
  nFresh uuid; nNormal uuid; nStale uuid; nExpired uuid; nHidden uuid; nOff uuid; r record; n int; ok boolean; ids uuid[];
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (uA, 'authenticated', 'authenticated', 'a@example.test', '{}'), (u2, 'authenticated', 'authenticated', 'b@example.test', '{}'), (u3, 'authenticated', 'authenticated', 'c@example.test', '{}');
  insert into public.news_sources (key, name, feed_url, home_url, enabled) values ('nt-on', 'Teszt Hírek', 'https://x.test/rss', 'https://x.test', true), ('nt-off', 'Kikapcsolt', 'https://y.test/rss', 'https://y.test', false);
  -- deals: TTL 7 nap → fresh <24h; normal ~3 nap; stale (>70% = 4,9 nap) 6 nap
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values
    ('nt-on', 'https://x.test/fresh',   'Friss',     'deals',   now() - interval '2 hours', now() - interval '2 hours' + interval '7 days') returning id into nFresh;
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values
    ('nt-on', 'https://x.test/normal',  'Normál',    'deals',   now() - interval '3 days',  now() - interval '3 days' + interval '7 days') returning id into nNormal;
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values
    ('nt-on', 'https://x.test/stale',   'Régi',      'banking', now() - interval '6 days',  now() - interval '6 days' + interval '7 days') returning id into nStale;
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values
    ('nt-on', 'https://x.test/expired', 'Lejárt',    'deals',   now() - interval '9 days',  now() - interval '2 days') returning id into nExpired;
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at, is_hidden) values
    ('nt-on', 'https://x.test/hidden',  'Rejtett',   'deals',   now() - interval '1 hour',  now() + interval '6 days', true) returning id into nHidden;
  insert into public.news_items (source_key, url, title, topic, published_at, expires_at) values
    ('nt-off', 'https://y.test/off',    'Kikapcsolt forrás', 'deals', now() - interval '1 hour', now() + interval '6 days') returning id into nOff;

  perform set_config('request.jwt.claims', json_build_object('sub', uA, 'role', 'authenticated')::text, true);
  set local role authenticated;

  select count(*) into n from public.news_feed(null, 50); assert n = 3, 'látható hírek: ' || n;       -- fresh, normal, stale
  select array_agg(id order by published_at desc) into ids from public.news_feed(null, 50);
  assert ids = array[nFresh, nNormal, nStale], 'rendezés (legfrissebb elöl)';
  select freshness into r from public.news_get(nFresh); assert r.freshness = 'fresh', 'fresh: ' || r.freshness;
  select freshness into r from public.news_get(nNormal); assert r.freshness = 'normal', 'normal: ' || r.freshness;
  select freshness into r from public.news_get(nStale); assert r.freshness = 'stale', 'stale: ' || r.freshness;
  select source_name into r from public.news_get(nFresh); assert r.source_name = 'Teszt Hírek', 'forrás neve';
  select count(*) into n from public.news_get(nExpired); assert n = 0, 'lejárt tétel látszik';
  select count(*) into n from public.news_get(nHidden); assert n = 0, 'rejtett tétel látszik';
  select count(*) into n from public.news_get(nOff); assert n = 0, 'kikapcsolt forrás tétele látszik';
  select count(*) into n from public.news_feed('banking', 50); assert n = 1, 'téma-szűrő: ' || n;

  -- kurzor-lapozás: 2 + 1
  select array_agg(id order by published_at desc) into ids from public.news_feed(null, 2); assert array_length(ids, 1) = 2, 'lap 1';
  select count(*) into n from public.news_feed(null, 2, (select published_at from public.news_get(ids[2])), ids[2]); assert n = 1, 'lap 2: ' || n;
  select id into r from public.news_feed(null, 2, (select published_at from public.news_get(ids[2])), ids[2]); assert r.id = nStale, 'lap 2 tartalma';

  -- közvetlen tábla-hozzáférés tiltott
  ok := false; begin perform count(*) from public.news_items; exception when insufficient_privilege then ok := true; end; assert ok, 'news_items közvetlenül olvasható';
  ok := false; begin perform count(*) from public.news_sources; exception when insufficient_privilege then ok := true; end; assert ok, 'news_sources olvasható';

  -- jelentések: 1 felhasználó kétszer nem jelenthet; 3 különböző → elrejtés
  insert into public.news_reports (news_id, reason) values (nFresh, 'outdated');
  ok := false; begin insert into public.news_reports (news_id, reason) values (nFresh, 'wrong'); exception when unique_violation then ok := true; end; assert ok, 'dupla jelentés';
  reset role;
  select count(*) into n from public.news_items where id = nFresh and is_hidden; assert n = 0, 'egy jelentésre elrejtve';
  perform set_config('request.jwt.claims', json_build_object('sub', u2, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.news_reports (news_id, reason) values (nFresh, 'spam'); reset role;
  select count(*) into n from public.news_items where id = nFresh and is_hidden; assert n = 0, 'két jelentésre elrejtve';
  perform set_config('request.jwt.claims', json_build_object('sub', u3, 'role', 'authenticated')::text, true); set local role authenticated;
  insert into public.news_reports (news_id, reason) values (nFresh, 'wrong');
  select count(*) into n from public.news_get(nFresh); reset role;
  select count(*) into n from public.news_items where id = nFresh and is_hidden; assert n = 1, 'három jelentés után nincs elrejtve';

  -- anon nem hívhatja
  set local role anon;
  ok := false; begin perform * from public.news_feed(); exception when insufficient_privilege then ok := true; end; assert ok, 'anon hívhatja a news_feed-et';
  reset role;

  raise notice 'A-25 teszt: MINDEN ELLENŐRZÉS ZÖLD';
end $$;

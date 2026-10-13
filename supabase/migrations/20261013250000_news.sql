-- A-24/A-25: hírforrások (a gazda jóváhagyta, 2026-10-13), news_feed/news_get RPC-k, automatikus elrejtés 3 jelentésre.
-- A nyers news_items-hez a kliensnek nincs közvetlen hozzáférése: csak az RPC-n át (a kikapcsolt forrás és az elrejtett/lejárt tétel azonnal eltűnik).

insert into public.news_sources (key, name, feed_url, home_url, topic_hint, license_note) values
  ('penzcentrum-vasarlas',     'Pénzcentrum',  'https://www.penzcentrum.hu/rss/vasarlas.xml',     'https://www.penzcentrum.hu/vasarlas',     'deals',   null),
  ('penzcentrum-megtakaritas', 'Pénzcentrum',  'https://www.penzcentrum.hu/rss/megtakaritas.xml', 'https://www.penzcentrum.hu/megtakaritas', 'saving',  null),
  ('penzcentrum-hitel',        'Pénzcentrum',  'https://www.penzcentrum.hu/rss/hitel.xml',        'https://www.penzcentrum.hu/hitel',        'banking', null),
  ('penzcentrum-biztositas',   'Pénzcentrum',  'https://www.penzcentrum.hu/rss/biztositas.xml',   'https://www.penzcentrum.hu/biztositas',   'banking', null),
  ('penzcentrum-otthon',       'Pénzcentrum',  'https://www.penzcentrum.hu/rss/otthon.xml',       'https://www.penzcentrum.hu/otthon',       null,      null),
  ('portfolio-all',            'Portfolio',    'https://www.portfolio.hu/rss/all.xml',            'https://www.portfolio.hu',                null,      null),
  ('telex-all',                'Telex',        'https://telex.hu/rss',                            'https://telex.hu',                        null,      null),
  ('index-gazdasag',           'Index',        'https://index.hu/gazdasag/rss/',                  'https://index.hu/gazdasag',               null,      null),
  ('hvg-gazdasag',             'HVG',          'https://hvg.hu/rss/gazdasag',                     'https://hvg.hu/gazdasag',                 null,      null)
on conflict (key) do update set name = excluded.name, feed_url = excluded.feed_url, home_url = excluded.home_url, topic_hint = excluded.topic_hint;
update public.news_sources set license_note =
  'Csak cím + rövid kivonat (≤200 kar.) + a feed saját képe + visszalink. A forrás-listát a gazda jóváhagyta (2026-10-13); a kiadói felhasználási feltételek külön jogi átnézésre várnak.'
 where license_note is null;

-- közvetlen hozzáférés megszüntetése
drop policy if exists news_select on public.news_items;
revoke all on public.news_items from authenticated, anon;

create or replace function public.news_feed(
  p_topic text default null, p_limit int default 12, p_before_published timestamptz default null, p_before_id uuid default null)
returns table (id uuid, source_key text, source_name text, url text, title text, snippet text, image_url text, topic text,
               published_at timestamptz, expires_at timestamptz, freshness text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.source_key, s.name, n.url, n.title, n.snippet, n.image_url, n.topic, n.published_at, n.expires_at,
         case when now() - n.published_at < interval '24 hours' then 'fresh'
              when now() > n.published_at + (n.expires_at - n.published_at) * 0.7 then 'stale'
              else 'normal' end
    from public.news_items n
    join public.news_sources s on s.key = n.source_key and s.enabled
   where auth.uid() is not null and not n.is_hidden and n.expires_at > now()
     and (p_topic is null or n.topic = p_topic)
     and (p_before_published is null
          or (n.published_at, n.id) < (p_before_published, coalesce(p_before_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid)))
   order by n.published_at desc, n.id desc
   limit least(greatest(coalesce(p_limit, 12), 1), 50)
$$;

create or replace function public.news_get(p_id uuid)
returns table (id uuid, source_key text, source_name text, url text, title text, snippet text, image_url text, topic text,
               published_at timestamptz, expires_at timestamptz, freshness text)
language sql stable security definer set search_path = '' as $$
  select n.id, n.source_key, s.name, n.url, n.title, n.snippet, n.image_url, n.topic, n.published_at, n.expires_at,
         case when now() - n.published_at < interval '24 hours' then 'fresh'
              when now() > n.published_at + (n.expires_at - n.published_at) * 0.7 then 'stale'
              else 'normal' end
    from public.news_items n
    join public.news_sources s on s.key = n.source_key and s.enabled
   where auth.uid() is not null and n.id = p_id and not n.is_hidden and n.expires_at > now()
$$;

-- ≥ 3 különböző felhasználó jelentése → automatikus elrejtés (felülvizsgálatra)
create or replace function public.news_reports_after_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(distinct user_id) from public.news_reports where news_id = new.news_id) >= 3 then
    update public.news_items set is_hidden = true where id = new.news_id;
  end if;
  return null;
end $$;
create trigger news_reports_hide after insert on public.news_reports for each row execute function public.news_reports_after_insert();
revoke execute on function public.news_reports_after_insert() from public, anon, authenticated;

revoke execute on function public.news_feed(text, int, timestamptz, uuid), public.news_get(uuid) from public, anon;
grant  execute on function public.news_feed(text, int, timestamptz, uuid), public.news_get(uuid) to authenticated;

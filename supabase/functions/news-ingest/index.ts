// A-23: hírek betöltése engedélyezőlistás kiadói RSS-ekből (pg_cron, 30 percenként). ARCHITECTURE.md §18.2–§18.3.
// Védelem (H7): csak a news_sources táblában felvett URL; dátum nélküli/jövőbeli/30 napnál régebbi tétel eldobva; minden tételnek van lejárata;
// csak cím + rövid kivonat + a feed saját képe + visszalink kerül tárolásra. Egy forrás hibája nem töri el a többit.
import { cronAuthorized, json, pool } from '../_shared/auth.ts';
import { adminClient } from '../_shared/supabase.ts';
import { dedupe, normalizeItem, parseFeed, titleKey, type NewsItem, type Topic } from '../_shared/rss.ts';

const MAX_BYTES = 2 * 1024 * 1024;
const MIN_INTERVAL_MS = 25 * 60_000;     // forrásonként legfeljebb ~30 percenként kérünk

interface Source { key: string; feed_url: string; topic_hint: Topic | null; etag: string | null; last_modified: string | null; last_fetched_at: string | null }

async function fetchFeed(src: Source): Promise<{ status: number; xml: string | null; etag: string | null; lastModified: string | null }> {
  const headers: Record<string, string> = { 'User-Agent': 'BankReminderBot/1.0 (news reader)', Accept: 'application/rss+xml, application/xml, text/xml' };
  if (src.etag) headers['If-None-Match'] = src.etag;
  if (src.last_modified) headers['If-Modified-Since'] = src.last_modified;
  const res = await fetch(src.feed_url, { headers, signal: AbortSignal.timeout(10_000), redirect: 'follow' });
  if (res.status === 304) return { status: 304, xml: null, etag: src.etag, lastModified: src.last_modified };
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new Error('too_large');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) throw new Error('too_large');
  return { status: res.status, xml: res.ok ? new TextDecoder().decode(buf) : null, etag: res.headers.get('etag'), lastModified: res.headers.get('last-modified') };
}

Deno.serve(async (req) => {
  if (!cronAuthorized(req)) return json(403, { error: 'forbidden' });
  const admin = adminClient();
  const { data: sources, error } = await admin.from('news_sources')
    .select('key, feed_url, topic_hint, etag, last_modified, last_fetched_at').eq('enabled', true);
  if (error) { console.error('sources_failed', error.code); return json(500, { error: 'sources_failed' }); }

  const now = new Date();
  const collected: NewsItem[] = [];
  const stats = { sources: sources?.length ?? 0, skipped: 0, errors: 0, items: 0, upserted: 0 };

  await pool((sources ?? []) as Source[], 4, async (src) => {
    if (src.last_fetched_at && now.getTime() - Date.parse(src.last_fetched_at) < MIN_INTERVAL_MS) { stats.skipped++; return; }
    try {
      const r = await fetchFeed(src);
      if (r.status !== 304 && !r.xml) throw Object.assign(new Error(`http_${r.status}`), { status: r.status });
      if (r.xml) {
        const items = parseFeed(r.xml).map((i) => normalizeItem(i, { key: src.key, topic_hint: src.topic_hint }, now)).filter((x): x is NewsItem => !!x);
        collected.push(...items);
      }
      await admin.from('news_sources').update({ etag: r.etag, last_modified: r.lastModified, last_fetched_at: now.toISOString(), last_status: r.status, last_error: null }).eq('key', src.key);
    } catch (e) {
      stats.errors++;
      const err = e as Error & { status?: number };
      await admin.from('news_sources').update({ last_fetched_at: now.toISOString(), last_status: err.status ?? 0, last_error: err.message.slice(0, 200) }).eq('key', src.key);
    }
  });

  // közel-duplikátum a már tárolt (friss) tételekkel szemben is
  let unique = dedupe(collected);
  const { data: recent } = await admin.from('news_items').select('title, url').gte('published_at', new Date(now.getTime() - 3 * 86_400_000).toISOString());
  const known = new Map((recent ?? []).map((r) => [titleKey(r.title as string), r.url as string]));
  unique = unique.filter((i) => { const u = known.get(titleKey(i.title)); return !u || u === i.url; });
  stats.items = unique.length;

  for (let i = 0; i < unique.length; i += 200) {
    const chunk = unique.slice(i, i + 200);
    const { error: e } = await admin.from('news_items').upsert(chunk, { onConflict: 'url' });   // is_hidden nincs a payloadban → nem íródik felül
    if (e) { console.error('upsert_failed', e.code); stats.errors++; } else stats.upserted += chunk.length;
  }
  return json(200, stats);
});

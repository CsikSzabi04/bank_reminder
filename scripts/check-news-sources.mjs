#!/usr/bin/env node
// A-24: hírforrások élő ellenőrzése (HTTP, tétel-szám, kép-arány, legfrissebb dátum). Nem ír adatbázisba.
const SOURCES = {
  'penzcentrum-vasarlas': 'https://www.penzcentrum.hu/rss/vasarlas.xml', 'penzcentrum-megtakaritas': 'https://www.penzcentrum.hu/rss/megtakaritas.xml',
  'penzcentrum-hitel': 'https://www.penzcentrum.hu/rss/hitel.xml', 'penzcentrum-biztositas': 'https://www.penzcentrum.hu/rss/biztositas.xml',
  'penzcentrum-otthon': 'https://www.penzcentrum.hu/rss/otthon.xml', 'portfolio-all': 'https://www.portfolio.hu/rss/all.xml',
  'telex-all': 'https://telex.hu/rss', 'index-gazdasag': 'https://index.hu/gazdasag/rss/', 'hvg-gazdasag': 'https://hvg.hu/rss/gazdasag',
};
for (const [key, url] of Object.entries(SOURCES)) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'BankReminderBot/1.0' }, signal: AbortSignal.timeout(15000) });
    const x = await r.text();
    const items = x.split(/<item[\s>]/i).slice(1);
    const img = items.filter((i) => /<enclosure[^>]+url=|<media:content[^>]+url=|<media:thumbnail[^>]+url=/i.test(i)).length;
    const dates = items.map((i) => Date.parse((i.match(/<pubDate>([^<]+)</i) ?? [])[1])).filter(Number.isFinite);
    const newest = dates.length ? new Date(Math.max(...dates)).toISOString().slice(0, 16) : '—';
    console.log(`${r.status} ${key.padEnd(26)} tétel:${String(items.length).padStart(3)}  kép:${img}/${items.length}  legfrissebb:${newest}  etag:${r.headers.get('etag') ? 'igen' : 'nem'}  méret:${(x.length / 1024).toFixed(0)}kB`);
  } catch (e) { console.log(`ERR ${key}: ${e.message}`); }
}

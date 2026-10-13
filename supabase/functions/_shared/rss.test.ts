import { assert, assertEquals } from 'jsr:@std/assert@1';
import { canonicalUrl, classify, dedupe, normalizeItem, parseFeed, stripHtml, truncateWords, type RawItem } from './rss.ts';

const NOW = new Date('2026-10-13T18:00:00Z');
const src = { key: 'test', topic_hint: null as null };
const raw = (o: Partial<RawItem>): RawItem => ({ title: 'x', link: 'https://x.test/a', description: '', pubDate: 'Tue, 13 Oct 2026 17:00:00 +0200', image: 'https://cdn.x.test/i.jpg', ...o });

const PC = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>PC</title>
<item><title><![CDATA[379 forintos banán és 159 forintos tej: brutális akciók tarolnak az Auchantól a Tescoig]]></title>
<link>https://www.penzcentrum.hu/vasarlas/20261013/akciok-1?utm_source=rss&amp;x=1#c</link>
<description><![CDATA[<p>Heti <b>akciók</b> &amp; ajánlatok &eacute;s még egy kis szöveg.</p>]]></description>
<pubDate>Tue, 13 Oct 2026 19:15:00 +0200</pubDate><enclosure url="https://cdn.penzcentrum.hu/images/a.jpg" type="image/jpeg"/></item>
<item><title>Telex-szerű</title><link>https://telex.hu/x</link><description/><pubDate>Tue, 13 Oct 2026 19:03:06 +0200</pubDate>
<enclosure url="https://assets.telex.hu/b.jpg" type="image/jpeg" length="0"/></item></channel></rss>`;

Deno.test('parseFeed: CDATA, entitások, enclosure-kép', () => {
  const items = parseFeed(PC);
  assertEquals(items.length, 2);
  assertEquals(items[0].title, '379 forintos banán és 159 forintos tej: brutális akciók tarolnak az Auchantól a Tescoig');
  assertEquals(items[0].image, 'https://cdn.penzcentrum.hu/images/a.jpg');
  assertEquals(stripHtml(items[0].description), 'Heti akciók & ajánlatok és még egy kis szöveg.');
});

Deno.test('normalizeItem: a gazda példája → deals, 7 napos lejárat, utm lecsupaszítva', () => {
  const n = normalizeItem(parseFeed(PC)[0], { key: 'penzcentrum-vasarlas', topic_hint: 'deals' }, NOW)!;
  assertEquals(n.topic, 'deals');
  assertEquals(n.url, 'https://www.penzcentrum.hu/vasarlas/20261013/akciok-1?x=1');
  assertEquals(n.published_at, '2026-10-13T17:15:00.000Z');
  assertEquals(n.expires_at, '2026-10-20T17:15:00.000Z');                 // +7 nap
  assertEquals(n.image_url, 'https://cdn.penzcentrum.hu/images/a.jpg');
});

Deno.test('időellenőrzés: jövőbeli, régi, dátum nélküli tétel eldobva', () => {
  const t = 'Akciók a Tescóban';
  assertEquals(normalizeItem(raw({ title: t, pubDate: 'Thu, 15 Oct 2026 12:00:00 +0200' }), src, NOW), null);   // +2 nap = jövő
  assertEquals(normalizeItem(raw({ title: t, pubDate: 'Mon, 01 Sep 2026 12:00:00 +0200' }), src, NOW), null);   // > 30 nap
  assertEquals(normalizeItem(raw({ title: t, pubDate: '' }), src, NOW), null);
  assertEquals(normalizeItem(raw({ title: t, pubDate: 'nem dátum' }), src, NOW), null);
  assert(normalizeItem(raw({ title: t, pubDate: 'Wed, 14 Oct 2026 06:00:00 +0200' }), src, NOW), 'a +12 órás eltérés még elfogadható');
});

Deno.test('besorolás: témák, tiltólista, zaj kiszűrése', () => {
  assertEquals(classify('Drágul a rezsi: itt az áramár-emelés', '', null)?.topic, 'utilities');
  assertEquals(classify('Emelkedik a kamat, drágább lesz a hitel', '', null)?.topic, 'banking');
  assertEquals(classify('Így spórolhatsz havonta tízezreket', '', null)?.topic, 'saving');
  assertEquals(classify('Ledobta a bombát az amerikai bankóriás: megmozdult a tőzsde', 'Emelkedik a magyar tőzsde', null), null);   // „bankóriás" ≠ bankköltség
  assertEquals(classify('Tisza-kormány: interjút ad a miniszterelnök', 'A parlament ülésezik', null), null);
  assertEquals(classify('Heti horoszkóp: akciók a csillagokban', '', null), null);                                                    // tiltólista
  assertEquals(classify('Olcsóbb vizes világbajnokságot akar a kormány', '', null), null);                                          // 'olcsó' önmagában nem akció
  assertEquals(classify('Lidl: olcsó sajt a polcokon', '', null)?.topic, 'deals');                                                    // bolt-névvel igen
  assertEquals(classify('Újra bepanaszolták Magyarországot a bolti különadó miatt: odacsapott a Spar', '', 'deals'), null);        // bolt-név önmagában nem akció
  assertEquals(classify('Kiadták a riasztást: visszahívnak egy terméket', '', 'deals'), null);                                         // deals-hint kulcsszó nélkül nem elég
  assertEquals(classify('Bármilyen cikk', '', 'banking')?.topic, 'banking');                                                           // téma-csatorna: a hint elég
});

Deno.test('kivonat ≤ 200 karakter szóhatáron, HTML nélkül; URL-kanonizálás', () => {
  const long = 'szó '.repeat(100);
  const s = truncateWords(long);
  assert(s.length <= 201 && s.endsWith('…'), String(s.length));
  assertEquals(stripHtml('<p>a&nbsp;&amp;&#233;&#x41;<br>b</p>'), 'a &éA b');
  assertEquals(canonicalUrl('https://a.test/p?utm_source=x&id=2&fbclid=z#top'), 'https://a.test/p?id=2');
  assertEquals(canonicalUrl('javascript:alert(1)'), null);
  assertEquals(canonicalUrl('nem url'), null);
});

Deno.test('kép: csak https', () => {
  const n = normalizeItem(raw({ title: 'Akciók a Tescóban', image: 'http://cdn.x.test/i.jpg' }), src, NOW)!;
  assertEquals(n.image_url, null);
});

Deno.test('deduplikálás: azonos cím két forrásból egy marad; más cím marad', () => {
  const a = normalizeItem(raw({ title: 'Akciók a Tescóban', link: 'https://a.test/1' }), { key: 'a', topic_hint: 'deals' }, NOW)!;
  const b = normalizeItem(raw({ title: 'Akciók a Tescóban!', link: 'https://b.test/2' }), { key: 'b', topic_hint: null }, NOW)!;
  const c = normalizeItem(raw({ title: 'Akciók az Aldiban', link: 'https://b.test/3' }), { key: 'b', topic_hint: null }, NOW)!;
  const same = normalizeItem(raw({ title: 'Akciók a Tescóban', link: 'https://a.test/1?utm_source=z' }), { key: 'a', topic_hint: 'deals' }, NOW)!;
  const out = dedupe([a, b, c, same]);
  assertEquals(out.length, 2);
  assertEquals(out.find((i) => i.title.includes('Tescó'))?.source_key, 'a');            // a magasabb pontszámú (deals-hint) marad
});

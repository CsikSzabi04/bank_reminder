// Hírek: RSS-parse, tisztítás, besorolás, lejárat, deduplikálás (ARCHITECTURE.md §18.2–§18.4). Tiszta függvények, nincs I/O.
// H7: nincs generált szöveg — csak a kiadó saját címe + rövid (≤200 kar.) kivonata + a feed saját képe + visszalink; minden tételnek van dátuma és lejárata.
import { XMLParser } from 'npm:fast-xml-parser@4.5.0';

export type Topic = 'deals' | 'utilities' | 'banking' | 'saving' | 'prices' | 'general';
export interface RawItem { title: string; link: string; description: string; pubDate: string; image: string | null }
export interface SourceInfo { key: string; topic_hint: Topic | null }
export interface NewsItem {
  source_key: string; url: string; title: string; snippet: string | null; image_url: string | null;
  topic: Topic; score: number; published_at: string; expires_at: string;
}

/** lejárat napokban témánként; kemény plafon: 30 nap */
export const TTL_DAYS: Record<Topic, number> = { deals: 7, prices: 7, utilities: 21, banking: 21, saving: 30, general: 14 };
export const MAX_AGE_DAYS = 30;
const SNIPPET_MAX = 200;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', processEntities: true, htmlEntities: true, trimValues: true, parseTagValue: false });

type Attrs = Record<string, string>;
const list = (v: unknown): unknown[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v : [v]);
const txt = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'object' && v !== null && '#text' in v ? String((v as Record<string, unknown>)['#text']) : '');

export function parseFeed(xml: string): RawItem[] {
  const doc = parser.parse(xml) as { rss?: { channel?: { item?: unknown } } };
  return list(doc?.rss?.channel?.item).map((raw) => {
    const i = raw as Record<string, unknown>;
    const enc = (list(i.enclosure) as Attrs[]).find((e) => !!e?.['@_url'] && /^image\//.test(e['@_type'] ?? 'image/'));
    const media = (list(i['media:content']) as Attrs[])[0] ?? (list(i['media:thumbnail']) as Attrs[])[0];
    return {
      title: txt(i.title), link: txt(i.link), description: txt(i.description), pubDate: txt(i.pubDate),
      image: enc?.['@_url'] ?? media?.['@_url'] ?? null,
    };
  }).filter((i) => i.title && i.link);
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', ouml: 'ö', odblac: 'ő', uacute: 'ú', uuml: 'ü', udblac: 'ű',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Ouml: 'Ö', Odblac: 'Ő', Uacute: 'Ú', Uuml: 'Ü', Udblac: 'Ű',
  ndash: '–', mdash: '—', hellip: '…', laquo: '«', raquo: '»', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', bdquo: '„', euro: '€', copy: '©',
};
export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, g: string) => {
      if (g[0] === '#') { const n = g[1].toLowerCase() === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10); return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : ' '; }
      return ENTITIES[g] ?? ENTITIES[g.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, ' ').trim();
}

export function truncateWords(s: string, max = SNIPPET_MAX): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 30)).replace(/[\s,;:.–—-]+$/, '') + '…';
}

export function canonicalUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    for (const k of [...u.searchParams.keys()]) if (/^(utm_|fbclid|gclid|mc_|ref$|source$)/i.test(k)) u.searchParams.delete(k);
    u.hash = '';
    return u.toString();
  } catch { return null; }
}

/** ékezet- és kisbetű-független összehasonlító forma */
export const fold = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// ───── besorolás ─────
// Valós feedeken hangolva (2026-10-13): a bolt-név ÖNMAGÁBAN nem akció; az ingatlan- és tőzsdei hír nem rezsi/megtakarítás.
const DEALS_CORE = /\b(le)?akcio|\blearazas|\bkedvezmeny|\bkupon|\bszorolap|\bhetvegi ajanlat|\bblack friday|\b\d+ forintos\b|\bingyenes szallitas/;
const DEALS_SOFT = /\bolcso/;   // 'olcsó' önmagában kevés (pl. 'olcsóbb vizes vb'): csak bolt-névvel vagy akció-csatornán
const RETAILERS = /\b(tesco|lidl|aldi|spar|interspar|auchan|penny|cba|coop|rossmann)\b/;
const TOPIC_KEYWORDS: Record<Exclude<Topic, 'general' | 'deals'>, RegExp> = {   // egyenlő pontszámnál a sorrend dönt: a specifikusabb téma elöl
  utilities: /\b(rezsi|aram|aramszamla|gazszamla|tavho|villany|energiaar|kozmu|vizdij|futes|futesi|napelem|szolgaltato)\b/,
  banking: /\b(bankkoltseg|bankszamla|bankkartya|bankok|bankokban|banki|bankszovetseg|szamlavezet|hitel|kamat|kamatstop|thm|betet|biztositas|kgfb|casco|hitelkartya)/,
  saving: /\b(megtakaritas|sporol|takarekos|koltsegcsokkent|allamkotveny|haztartasi koltsegvetes|elofizetes|penztarca)/,
  prices: /\b(arfigyelo|arrestop|aremeles|arcsokkenes|inflacio|fogyasztoi arak?|elelmiszerar|uzemanyagar|benzinar|uzemanyag|benzin)\b/,
};
const DENY = /\b(foci|bajnoksag|horoszkop|celeb|bulvar|sztar|valas|szerelem|idojaras-elorejelzes|nyeroszam|lotto)/;

export interface Classified { topic: Topic; score: number }
export function classify(title: string, snippet: string, hint: Topic | null): Classified | null {
  const t = fold(title); const s = fold(snippet);
  if (DENY.test(t)) return null;
  let best: Classified | null = null;
  const consider = (topic: Topic, inT: boolean, inS: boolean, extra = 0) => {
    if (!inT && !inS) return;
    const score = (inT ? 3 : 0) + (inS ? 1 : 0) + extra + (hint === topic ? 2 : 0);
    if (!best || score > best.score) best = { topic, score };
  };
  const retail = RETAILERS.test(t) || RETAILERS.test(s);
  const soft = (x: string) => DEALS_SOFT.test(x) && (retail || hint === 'deals');
  const dT = DEALS_CORE.test(t) || soft(t); const dS = DEALS_CORE.test(s) || soft(s);
  consider('deals', dT, dS, (dT || dS) && retail ? 1 : 0);
  for (const [topic, re] of Object.entries(TOPIC_KEYWORDS) as Array<[Topic, RegExp]>) consider(topic, re.test(t), re.test(s));
  if (best) return (best as Classified).score >= 2 ? best : null;
  if (hint === 'banking') return { topic: hint, score: 2 };   // csak a hitel/biztosítás-csatornánál elég a hint (a háztartási költségek közvetlen tárgya)
  return null;
}

export const titleKey = (title: string) => fold(title).replace(/[^a-z0-9]+/g, ' ').trim();
const DAY = 86_400_000;

/** egy nyers tételből szabályos hír, vagy null (eldobva) — most: a „jelen" időpont */
export function normalizeItem(raw: RawItem, src: SourceInfo, now: Date): NewsItem | null {
  const url = canonicalUrl(raw.link);
  if (!url) return null;
  const published = Date.parse(raw.pubDate);
  if (!Number.isFinite(published)) return null;                       // dátum nélkül nincs hír (H7)
  if (published > now.getTime() + DAY) return null;                   // jövőbeli
  if (published < now.getTime() - MAX_AGE_DAYS * DAY) return null;    // túl régi
  const title = stripHtml(raw.title).slice(0, 300);
  if (!title) return null;
  const snippetFull = stripHtml(raw.description);
  const cls = classify(title, snippetFull, src.topic_hint);
  if (!cls) return null;
  const pub = Math.min(published, now.getTime());
  const ttl = Math.min(TTL_DAYS[cls.topic], MAX_AGE_DAYS);
  let image: string | null = null;
  try { const u = new URL(raw.image ?? ''); if (u.protocol === 'https:') image = u.toString(); } catch { /* nincs kép */ }
  return {
    source_key: src.key, url, title, snippet: snippetFull ? truncateWords(snippetFull) : null, image_url: image,
    topic: cls.topic, score: cls.score, published_at: new Date(pub).toISOString(), expires_at: new Date(pub + ttl * DAY).toISOString(),
  };
}

/** URL szerint egyedi; azonos cím (±48 óra) több forrásból → a magasabb pontszámú / korábbi marad */
export function dedupe(items: NewsItem[]): NewsItem[] {
  const byUrl = new Map<string, NewsItem>();
  for (const i of items) if (!byUrl.has(i.url)) byUrl.set(i.url, i);
  const out: NewsItem[] = [];
  const sorted = [...byUrl.values()].sort((a, b) => b.score - a.score || Date.parse(a.published_at) - Date.parse(b.published_at));
  for (const i of sorted) {
    const k = titleKey(i.title);
    const dup = out.find((o) => titleKey(o.title) === k && Math.abs(Date.parse(o.published_at) - Date.parse(i.published_at)) <= 2 * DAY);
    if (!dup) out.push(i);
  }
  return out;
}

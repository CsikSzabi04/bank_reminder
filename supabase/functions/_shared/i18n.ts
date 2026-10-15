// Értesítés-szövegek HU/EN (ARCHITECTURE.md §12.3, §12.6). Tiszta függvények (nincs I/O) → egységtesztelhetők.
// A szöveg KÜLDÉSKOR készül a felhasználó nyelvén (a payload csak adat), így nyelvváltás után a függő értesítések is új nyelven mennek.

export type Locale = 'hu' | 'en';

export interface NotificationRow {
  id: string;
  kind: string;
  reminder_id: string | null;
  occurrence_id: string | null;
  payload: Record<string, unknown>;
  dedupe_key: string;
  scheduled_for: string;
}

export interface RenderOptions {
  locale: Locale;
  /** „ma" a profil időzónájában, YYYY-MM-DD */
  today: string;
  hideDetails: boolean;
  /** teszt-értesítéshez: az eszköz neve */
  device?: string;
  /** nyitott/lejárt esedékesek száma az app-jelvényhez */
  badge?: number;
}

export interface Rendered {
  v: 1;
  kind: string;
  title: string;
  body: string;
  /** relatív mély link */
  url: string;
  /** ≤ 32 karakter, [A-Za-z0-9_-]: azonos tag = felülírja az előzőt (nem halmozódik) */
  tag: string;
  occId?: string;
  badge?: number;
  actions: Array<{ action: 'paid' | 'snooze'; title: string }>;
  ts: number;
  lang: Locale;
}

const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : Number(v ?? d));

export function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(`${fromYmd}T00:00:00Z`);
  const b = Date.parse(`${toYmd}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

export function formatMoney(locale: Locale, amount: number, currency: string): string {
  const cur = /^[A-Z]{3}$/.test(currency) ? currency : 'HUF';
  return new Intl.NumberFormat(locale === 'hu' ? 'hu-HU' : 'en-GB', {
    style: 'currency', currency: cur, maximumFractionDigits: cur === 'HUF' ? 0 : 2, minimumFractionDigits: cur === 'HUF' ? 0 : 2,
    useGrouping: 'always',   // egyezik az app formázójával (lib/format.ts): hu-HU alapból nem csoportosít 4 jegynél
  }).format(amount);
}

/** naptári nap (YYYY-MM-DD) rövid formában; UTC-ben formázunk, hogy az időzóna ne csússzon el a dátumon */
export function formatDay(locale: Locale, ymd: string): string {
  return new Intl.DateTimeFormat(locale === 'hu' ? 'hu-HU' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
    .format(new Date(`${ymd}T12:00:00Z`));
}

function when(locale: Locale, days: number): string {
  if (days <= 0) return locale === 'hu' ? 'ma esedékes' : 'due today';
  if (days === 1) return locale === 'hu' ? 'holnap esedékes' : 'due tomorrow';
  return locale === 'hu' ? `${days} nap múlva esedékes` : `due in ${days} days`;
}

const ACTIONS: Record<Locale, { paid: string; snooze: string }> = {
  hu: { paid: 'Kifizettem', snooze: 'Holnap emlékeztess' },
  en: { paid: 'Paid', snooze: 'Remind me tomorrow' },
};

const shortId = (id: string | null | undefined) => (id ?? '').replace(/-/g, '').slice(0, 16);

export function renderNotification(row: NotificationRow, o: RenderOptions): Rendered {
  const L = o.locale;
  const p = row.payload ?? {};
  const name = str(p.name, '—');
  const cur = str(p.currency, 'HUF');
  const money = (a: unknown) => formatMoney(L, num(a), cur);
  const base: Rendered = {
    v: 1, kind: row.kind, title: '', body: '', url: '/dashboard', tag: `n-${shortId(row.id)}`,
    badge: o.badge, actions: [], ts: Date.parse(row.scheduled_for) || Date.now(), lang: L,
  };
  const occ = row.occurrence_id ?? str(p.occ) ?? undefined;
  const withActions = (r: Rendered): Rendered => {
    if (occ) { r.occId = occ; r.actions = [{ action: 'paid', title: ACTIONS[L].paid }, { action: 'snooze', title: ACTIONS[L].snooze }]; }
    return r;
  };
  const discreet = (r: Rendered): Rendered => {
    r.title = L === 'hu' ? 'Fizetés esedékes' : 'A payment is due';
    r.body = L === 'hu' ? 'Nyisd meg az appot a részletekért.' : 'Open the app for details.';
    return r;
  };

  switch (row.kind) {
    case 'reminder': {
      const due = str(p.due_date);
      base.url = `/reminders/${row.reminder_id ?? ''}?occ=${occ ?? ''}`;
      base.tag = `rem-${shortId(occ)}`;
      if (o.hideDetails) return withActions(discreet(base));
      const days = daysBetween(o.today, due);
      base.title = days < 0
        ? (L === 'hu' ? `${name} — lejárt` : `${name} — overdue`)
        : `${name} — ${when(L, days)}`;
      base.body = days <= 0 ? money(p.amount) : `${money(p.amount)} · ${formatDay(L, due)}`;
      return withActions(base);
    }
    case 'overdue': {
      const due = str(p.due_date);
      base.url = `/reminders/${row.reminder_id ?? ''}?occ=${occ ?? ''}`;
      base.tag = `ovd-${shortId(occ)}`;
      if (o.hideDetails) return withActions(discreet(base));
      base.title = L === 'hu' ? `${name} — lejárt` : `${name} — overdue`;
      base.body = L === 'hu'
        ? `${formatDay(L, due)} óta várja a befizetést (${money(p.amount)}). Kifizetted?`
        : `Was due ${formatDay(L, due)} (${money(p.amount)}). Paid it?`;
      return withActions(base);
    }
    case 'trial_end': {
      const end = str(p.trial_ends_on);
      base.url = `/reminders/${row.reminder_id ?? ''}`;
      base.tag = `trial-${shortId(row.reminder_id)}`;
      const days = daysBetween(o.today, end);
      const w = days <= 0 ? (L === 'hu' ? 'ma' : 'today') : days === 1 ? (L === 'hu' ? 'holnap' : 'tomorrow') : (L === 'hu' ? `${days} nap múlva` : `in ${days} days`);
      base.title = L === 'hu' ? `${name} — ${w} lejár az ingyenes próba` : `${name} — free trial ends ${w}`;
      base.body = L === 'hu' ? 'Ha nem kéred, mondd le még időben.' : "Cancel in time if you don't want it.";
      return base;
    }
    case 'digest': {
      const count = num(p.count);
      const total = formatMoney(L, num(p.total), str(p.base_currency, 'HUF'));
      const items = Array.isArray(p.items) ? (p.items as Array<Record<string, unknown>>).map((i) => str(i.name)).filter(Boolean) : [];
      base.url = '/calendar';
      base.tag = `digest-${shortId(row.id)}`;
      base.title = L === 'hu' ? `Következő 7 nap: ${count} tétel, ${total}` : `Next 7 days: ${count} bills, ${total}`;
      const more = count > items.length ? (L === 'hu' ? ` …és még ${count - items.length}` : ` …and ${count - items.length} more`) : '';
      base.body = items.join(', ') + more;
      return base;
    }
    case 'system': {
      base.url = '/profile?section=notifications';
      base.tag = `test-${shortId(row.id)}`;
      base.title = L === 'hu' ? 'Működik! 🎉' : 'It works! 🎉';
      base.body = L === 'hu' ? `Ez egy teszt-értesítés (${o.device ?? 'eszköz'}).` : `This is a test notification (${o.device ?? 'device'}).`;
      return base;
    }
    case 'budget': {
      // keret-riasztás (A-45): tény, nem tanács (H10); a kategória-név a payloadban mindkét nyelven megvan
      const cat = L === 'hu' ? str(p.category_name_hu, '—') : str(p.category_name_en, str(p.category_name_hu, '—'));
      const id = str(p.category_id);
      base.url = /^[0-9a-f-]{36}$/i.test(id) ? `/budgets/${id}` : '/budgets';
      base.tag = `bud-${shortId(id)}-${str(p.level) === 'over' ? 'over' : 'watch'}`;
      if (o.hideDetails) {
        base.title = L === 'hu' ? 'Keret-riasztás' : 'Budget alert';
        base.body = L === 'hu' ? 'Nyisd meg az appot a részletekért.' : 'Open the app for details.';
        return base;
      }
      const pct = Math.floor(num(p.pct));
      base.title = str(p.level) === 'over'
        ? (L === 'hu' ? `${cat}: elfogyott a havi keret` : `${cat}: monthly budget used up`)
        : (L === 'hu' ? `${cat}: a keret ${pct}%-a elfogyott` : `${cat}: ${pct}% of the budget used`);
      base.body = `${formatMoney(L, num(p.spent), cur)} / ${formatMoney(L, num(p.limit), cur)}`;
      return base;
    }
    default:
      base.title = 'Bank Reminder';
      base.body = '';
      return base;
  }
}

/** a push-üzenet törzse (≤ 4 KB) — szerződés: ARCHITECTURE.md §12.6 */
export function toPushPayload(r: Rendered): Record<string, unknown> {
  return {
    v: 1, kind: r.kind, title: r.title, body: r.body, url: r.url, tag: r.tag, occId: r.occId,
    badge: r.badge, actions: r.actions, ts: r.ts, lang: r.lang,
  };
}

/** egyszerű kétnyelvű e-mail (ha az e-mail csatorna be van kapcsolva) */
export function renderEmail(r: Rendered, appUrl: string): { subject: string; html: string; text: string } {
  const open = r.lang === 'hu' ? 'Megnyitás az appban' : 'Open in the app';
  const link = `${appUrl.replace(/\/$/, '')}${r.url}`;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return {
    subject: r.title,
    text: `${r.title}\n${r.body}\n\n${open}: ${link}\n`,
    html: `<div style="font-family:Inter,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F1720">
<h2 style="margin:0 0 8px">${esc(r.title)}</h2><p style="margin:0 0 20px;color:#334155">${esc(r.body)}</p>
<a href="${esc(link)}" style="display:inline-block;background:#0B7F70;color:#fff;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:12px">${open}</a>
<p style="margin:24px 0 0;font-size:12px;color:#64748B">Bank Reminder</p></div>`,
  };
}

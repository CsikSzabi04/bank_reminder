import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';
import { renderEmail, renderNotification, toPushPayload, type NotificationRow } from './i18n.ts';

const norm = (s: string) => s.replace(/[  ]/g, ' ');
const row = (kind: string, payload: Record<string, unknown>, extra: Partial<NotificationRow> = {}): NotificationRow => ({
  id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', kind, reminder_id: '11111111-2222-3333-4444-555555555555',
  occurrence_id: '99999999-8888-7777-6666-555555555555', payload, dedupe_key: 'k', scheduled_for: '2026-11-09T08:00:00Z', ...extra,
});
const rem = { name: 'Netflix', amount: 2300, currency: 'HUF', due_date: '2026-11-10', offset: 1 };

Deno.test('reminder HU: holnap esedékes + összeg + dátum + gombok', () => {
  const r = renderNotification(row('reminder', rem), { locale: 'hu', today: '2026-11-09', hideDetails: false });
  assertEquals(r.title, 'Netflix — holnap esedékes');
  assertEquals(norm(r.body), '2 300 Ft · nov. 10.');
  assertEquals(r.actions.map((a) => a.action), ['paid', 'snooze']);
  assertEquals(r.actions[0].title, 'Kifizettem');
  assertEquals(r.url, '/reminders/11111111-2222-3333-4444-555555555555?occ=99999999-8888-7777-6666-555555555555');
});

Deno.test('reminder EN + napok száma a küldés napjából számolódik (késve is igaz)', () => {
  const en = renderNotification(row('reminder', { ...rem, offset: 3 }), { locale: 'en', today: '2026-11-07', hideDetails: false });
  assertEquals(en.title, 'Netflix — due in 3 days');
  assertEquals(en.actions[0].title, 'Paid');
  // az 1 napos értesítés a lejárat napján küldődik ki (késés) → „ma esedékes", nem „holnap"
  assertEquals(renderNotification(row('reminder', rem), { locale: 'hu', today: '2026-11-10', hideDetails: false }).title, 'Netflix — ma esedékes');
  assertEquals(renderNotification(row('reminder', rem), { locale: 'hu', today: '2026-11-12', hideDetails: false }).title, 'Netflix — lejárt');
});

Deno.test('diszkrét mód: nincs név és összeg', () => {
  const r = renderNotification(row('reminder', rem), { locale: 'hu', today: '2026-11-09', hideDetails: true });
  assertEquals(r.title, 'Fizetés esedékes');
  const json = JSON.stringify(toPushPayload(r));
  assert(!json.includes('Netflix') && !json.includes('2300') && !json.includes('2 300'), 'szivárog a név/összeg: ' + json);
  assertEquals(renderNotification(row('reminder', rem), { locale: 'en', today: '2026-11-09', hideDetails: true }).title, 'A payment is due');
});

Deno.test('overdue, trial_end, digest, teszt', () => {
  const o = renderNotification(row('overdue', { ...rem, k: 1 }), { locale: 'hu', today: '2026-11-11', hideDetails: false });
  assertEquals(o.title, 'Netflix — lejárt');
  assertStringIncludes(norm(o.body), 'nov. 10. óta várja a befizetést (2 300 Ft). Kifizetted?');
  const t = renderNotification(row('trial_end', { name: 'HBO Max', trial_ends_on: '2026-11-10' }, { occurrence_id: null }), { locale: 'hu', today: '2026-11-09', hideDetails: false });
  assertEquals(t.title, 'HBO Max — holnap lejár az ingyenes próba');
  assertEquals(t.actions.length, 0);
  const d = renderNotification(row('digest', { count: 5, total: 14200, base_currency: 'HUF', items: [{ name: 'A' }, { name: 'B' }, { name: 'C' }] }, { reminder_id: null, occurrence_id: null }),
    { locale: 'hu', today: '2026-11-08', hideDetails: false });
  assertEquals(norm(d.title), 'Következő 7 nap: 5 tétel, 14 200 Ft');
  assertEquals(d.body, 'A, B, C …és még 2');
  const s = renderNotification(row('system', {}, { occurrence_id: null }), { locale: 'en', today: '2026-11-08', hideDetails: false, device: 'iPhone' });
  assertEquals(s.title, 'It works! 🎉');
  assertStringIncludes(s.body, 'iPhone');
});

Deno.test('tag: ≤ 32 karakter, csak [A-Za-z0-9_-]; EUR formázás; e-mail', () => {
  for (const k of ['reminder', 'overdue', 'trial_end', 'digest', 'system', 'budget']) {
    const r = renderNotification(row(k, { ...rem, count: 1, items: [] }), { locale: 'hu', today: '2026-11-09', hideDetails: false });
    assert(r.tag.length <= 32 && /^[A-Za-z0-9_-]+$/.test(r.tag), `${k}: ${r.tag}`);
  }
  const eur = renderNotification(row('reminder', { ...rem, amount: 9.99, currency: 'EUR' }), { locale: 'en', today: '2026-11-09', hideDetails: false });
  assertStringIncludes(norm(eur.body), '€9.99');
  const mail = renderEmail(renderNotification(row('reminder', { ...rem, name: '<b>x</b>' }), { locale: 'hu', today: '2026-11-09', hideDetails: false }), 'https://app.example/');
  assert(!mail.html.includes('<b>x</b>'), 'az e-mail nem escape-el');
  assertStringIncludes(mail.html, 'https://app.example/reminders/');
});

const bud = { level: 'over', category_id: '12345678-1234-1234-1234-123456789abc', category_name_hu: 'Étterem', category_name_en: 'Dining', spent: 16000, limit: 15000, pct: 106, currency: 'HUF', month: '2026-10' };
const budRow = (payload: Record<string, unknown>) => row('budget', payload, { reminder_id: null, occurrence_id: null });

Deno.test('budget HU/EN: over és watch szöveg, összeg / keret, mély link a kategóriára', () => {
  const o = renderNotification(budRow(bud), { locale: 'hu', today: '2026-10-15', hideDetails: false });
  assertEquals(o.title, 'Étterem: elfogyott a havi keret');
  assertEquals(norm(o.body), '16 000 Ft / 15 000 Ft');
  assertEquals(o.url, '/budgets/12345678-1234-1234-1234-123456789abc');
  assertEquals(o.actions, []);
  const w = renderNotification(budRow({ ...bud, level: 'watch', spent: 13050, pct: 87 }), { locale: 'hu', today: '2026-10-15', hideDetails: false });
  assertEquals(w.title, 'Étterem: a keret 87%-a elfogyott');
  const en = renderNotification(budRow(bud), { locale: 'en', today: '2026-10-15', hideDetails: false });
  assertEquals(en.title, 'Dining: monthly budget used up');
  assertEquals(norm(en.body), 'HUF 16,000 / HUF 15,000');
  assertEquals(renderNotification(budRow({ ...bud, level: 'watch', pct: 87 }), { locale: 'en', today: '2026-10-15', hideDetails: false }).title, 'Dining: 87% of the budget used');
});

Deno.test('budget: diszkrét mód nem szivárogtat kategóriát/összeget; érvénytelen id nem kerül a linkbe; a két szint tagje különbözik', () => {
  const d = renderNotification(budRow(bud), { locale: 'hu', today: '2026-10-15', hideDetails: true });
  const json = JSON.stringify(toPushPayload(d));
  assert(!json.includes('Étterem') && !json.includes('16000') && !json.includes('16 000'), 'szivárog: ' + json);
  assertEquals(d.title, 'Keret-riasztás');
  assertEquals(renderNotification(budRow({ ...bud, category_id: '../../x' }), { locale: 'hu', today: '2026-10-15', hideDetails: false }).url, '/budgets');
  const a = renderNotification(budRow(bud), { locale: 'hu', today: '2026-10-15', hideDetails: false });
  const b = renderNotification(budRow({ ...bud, level: 'watch' }), { locale: 'hu', today: '2026-10-15', hideDetails: false });
  assert(a.tag !== b.tag, 'az over és a watch azonos taggel felülírná egymást');
});

// A-19: árfolyamok (EUR bázis, ECB-adat) a Frankfurter API-ból → public.fx_rates. Munkanapokon fut (pg_cron).
// Üres táblánál 120 napnyi előzményt is betölt (a korábbi esedékességek átváltásához). Kulcs nem kell.
import { cronAuthorized, json } from '../_shared/auth.ts';
import { adminClient } from '../_shared/supabase.ts';

const API = 'https://api.frankfurter.dev/v1';
type Row = { as_of: string; currency: string; per_eur: number };

async function get(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'BankReminder/1.0' } });
  if (!res.ok) throw new Error(`frankfurter_${res.status}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (!cronAuthorized(req)) return json(403, { error: 'forbidden' });
  const admin = adminClient();
  try {
    const { count } = await admin.from('fx_rates').select('as_of', { count: 'exact', head: true });
    const rows: Row[] = [];
    if (!count) {
      const to = new Date(); const from = new Date(Date.now() - 120 * 86_400_000);
      const d = (await get(`${API}/${from.toISOString().slice(0, 10)}..${to.toISOString().slice(0, 10)}?base=EUR`)) as { rates: Record<string, Record<string, number>> };
      for (const [day, rates] of Object.entries(d.rates ?? {})) for (const [cur, v] of Object.entries(rates)) rows.push({ as_of: day, currency: cur, per_eur: v });
    } else {
      const d = (await get(`${API}/latest?base=EUR`)) as { date: string; rates: Record<string, number> };
      for (const [cur, v] of Object.entries(d.rates ?? {})) rows.push({ as_of: d.date, currency: cur, per_eur: v });
    }
    let written = 0;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500).filter((r) => /^[A-Z]{3}$/.test(r.currency) && r.per_eur > 0);
      const { error } = await admin.from('fx_rates').upsert(chunk, { onConflict: 'as_of,currency' });
      if (error) throw new Error(`upsert_${error.code}`);
      written += chunk.length;
    }
    return json(200, { ok: true, written, backfill: !count });
  } catch (e) {
    console.error('fx_refresh_failed', (e as Error).message);
    return json(502, { ok: false, error: (e as Error).message });
  }
});

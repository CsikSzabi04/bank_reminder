// Edge Function közös: cron-titok (konstans idejű), felhasználó a JWT-ből, JSON/CORS segédek. A naplóba SOHA nem kerül e-mail/név/összeg.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',   // JWT-s hívás, nincs süti → nem kockázatos
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  let r = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) r |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return r === 0;
}

/** pg_cron → pg_net hívás hitelesítése: x-cron-secret == CRON_SECRET (konstans idejű összehasonlítás) */
export function cronAuthorized(req: Request): boolean {
  const expected = Deno.env.get('CRON_SECRET');
  const got = req.headers.get('x-cron-secret');
  if (!expected || !got) return false;
  const enc = new TextEncoder();
  return timingSafeEqual(enc.encode(expected), enc.encode(got));
}

/** a hívó felhasználó a Bearer JWT-ből (az Auth szerver ellenőrzi) */
export async function userFromRequest(req: Request, admin: SupabaseClient): Promise<{ id: string; email?: string } | null> {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? undefined };
}

/** „ma" YYYY-MM-DD formában a megadott időzónában */
export function ymdIn(timeZone: string, d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function addDays(ymd: string, n: number): string {
  return new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
}

/** korlátozott párhuzamosságú feldolgozás */
export async function pool<T>(items: T[], size: number, fn: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const x = items[i++]; await fn(x); }
  }));
}

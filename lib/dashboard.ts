import "server-only";
import { cookies } from "next/headers";
import type { DashboardSummary } from "@/types/rpc";
import { createClient } from "@/utils/supabase/server";

const MONTH_PARAM = /^(\d{4})-(\d{2})$/;
export const MAX_MONTH_OFFSET = 24; // a hónap-váltó ennyi hónapot enged a mai naptól (±)

// Hónap-eltolás ("YYYY-MM-01" + n hónap)
export function shiftMonth(monthStart: string, delta: number): string {
  const d = new Date(`${monthStart}T00:00:00Z`);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function monthsBetween(a: string, b: string): number {
  return (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));
}

// ?month=YYYY-MM → "YYYY-MM-01"; érvénytelen vagy túl távoli érték → az aktuális hónap
export function resolveMonth(param: string | undefined, today: string): string {
  const current = `${today.slice(0, 7)}-01`;
  const m = param?.match(MONTH_PARAM);
  if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) return current;
  const requested = `${m[1]}-${m[2]}-01`;
  return Math.abs(monthsBetween(current, requested)) <= MAX_MONTH_OFFSET ? requested : current;
}

// Egyetlen RPC-hívás: hero + csoportok + következő 5 + előfizetések + keretek (A-10/A-11). Az összegeket az SQL számolja (H9).
export async function getDashboardSummary(monthStart: string): Promise<DashboardSummary | null> {
  const { data, error } = await (await createClient(await cookies())).rpc("dashboard_summary", { p_month: monthStart });
  if (error || !data) return null;
  return data as unknown as DashboardSummary;
}

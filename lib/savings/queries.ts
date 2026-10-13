import "server-only";
import { cookies } from "next/headers";
import { sumMoney } from "@/lib/money";
import { createClient } from "@/utils/supabase/server";

const client = async () => createClient(await cookies());

export type GoalView = {
  id: string;
  name: string;
  target: number;
  currency: string;
  targetDate: string | null;
  icon: string;
  colorSlot: number;
  archived: boolean;
  saved: number;
  /** a haladás százalékban (SQL), 100 felett is lehet */
  pct: number;
  reached: boolean;
  monthsLeft: number | null;
  neededPerMonth: number | null;
};

type ProgressRow = {
  id: string | null;
  name: string | null;
  target_amount: number | null;
  currency: string | null;
  target_date: string | null;
  icon: string | null;
  color_slot: number | null;
  archived_at: string | null;
  saved: number | null;
  pct: number | null;
  reached: boolean | null;
  months_left: number | null;
  needed_per_month: number | null;
};

const toView = (r: ProgressRow): GoalView | null =>
  r.id && r.name && r.target_amount !== null && r.currency
    ? {
        id: r.id,
        name: r.name,
        target: r.target_amount,
        currency: r.currency,
        targetDate: r.target_date,
        icon: r.icon ?? "piggy-bank",
        colorSlot: r.color_slot ?? 1,
        archived: r.archived_at !== null,
        saved: r.saved ?? 0,
        pct: r.pct ?? 0,
        reached: r.reached ?? false,
        monthsLeft: r.months_left,
        neededPerMonth: r.needed_per_month,
      }
    : null;

const COLUMNS = "id, name, target_amount, currency, target_date, icon, color_slot, archived_at, saved, pct, reached, months_left, needed_per_month";

// A haladást (összegyűlt, %, havi szükséges) a savings_goals_progress view számolja (A-11)
export async function getGoals(archived: boolean): Promise<GoalView[]> {
  const query = (await client()).from("savings_goals_progress").select(COLUMNS).order("created_at", { ascending: false });
  const { data } = await (archived ? query.not("archived_at", "is", null) : query.is("archived_at", null));
  return (data ?? []).flatMap((r) => toView(r) ?? []);
}

export async function getGoal(id: string): Promise<GoalView | null> {
  const { data } = await (await client()).from("savings_goals_progress").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toView(data) : null;
}

export type ContributionView = { id: string; amount: number; date: string; note: string | null };

export async function getContributions(goalId: string): Promise<ContributionView[]> {
  const { data } = await (await client())
    .from("goal_contributions")
    .select("id, amount, contributed_on, note")
    .eq("goal_id", goalId)
    .order("contributed_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(200);
  return (data ?? []).map((c) => ({ id: c.id, amount: c.amount, date: c.contributed_on, note: c.note }));
}

// Vészhelyzeti alap (§16.4): 3 × az átlagos havi kiadás. Az átlag az utolsó 3 hónap azon hónapjaiból jön, ahol volt kiadás
// (az SQL `analytics_monthly_trend` összegeiből); nincs adat → null (a cél kézzel adható meg).
export async function getEmergencyTarget(currency: string): Promise<number | null> {
  const { data } = await (await client()).rpc("analytics_monthly_trend", { p_months: 3 });
  const totals = (data ?? []).map((r) => sumMoney([r.paid, r.remaining])).filter((v) => v > 0);
  if (totals.length === 0) return null;
  const step = currency === "HUF" ? 1000 : 10;
  return Math.ceil((sumMoney(totals) * 3) / totals.length / step) * step;
}

import "server-only";
import { cookies } from "next/headers";
import type { DashboardSummary } from "@/types/rpc";
import type { Database } from "@/types/database.types";
import { createClient } from "@/utils/supabase/server";
import type { Range } from "./range";
import { rangeWindow } from "./range";

type Fn = Database["public"]["Functions"];
export type ByGroup = Fn["analytics_by_group"]["Returns"];
export type TrendRow = Fn["analytics_monthly_trend"]["Returns"][number];
export type CumulativeRow = Fn["analytics_cumulative"]["Returns"][number];
export type TopRow = Fn["analytics_top"]["Returns"][number];
export type GroupTrendRow = Fn["analytics_group_trend"]["Returns"][number];
export type UpcomingDay = Fn["upcoming_days"]["Returns"][number];
export type SubscriptionRow = Fn["analytics_subscriptions"]["Returns"][number];

export type AnalyticsData = {
  summary: DashboardSummary | null;
  byGroup: ByGroup;
  trend: TrendRow[];
  cumulative: CumulativeRow[];
  top: TopRow[];
  groupTrend: GroupTrendRow[];
  upcoming: UpcomingDay[];
  subscriptions: SubscriptionRow[];
};

// Minden diagram-adat egy körben (az összegeket az SQL számolja, H9); a hiba üres adatra esik vissza, az oldal nem dől el
export async function getAnalytics(month: string, range: Range, months: number): Promise<AnalyticsData> {
  const supabase = createClient(await cookies());
  const { from, to } = rangeWindow(range, month);
  const [summary, byGroup, trend, cumulative, top, groupTrend, upcoming, subscriptions] = await Promise.all([
    supabase.rpc("dashboard_summary", { p_month: month }),
    supabase.rpc("analytics_by_group", { p_from: from, p_to: to }),
    supabase.rpc("analytics_monthly_trend", { p_months: months }),
    supabase.rpc("analytics_cumulative", { p_month: month }),
    supabase.rpc("analytics_top", { p_from: from, p_to: to, p_limit: 5 }),
    supabase.rpc("analytics_group_trend", { p_months: months }),
    supabase.rpc("upcoming_days", { p_days: 30 }),
    supabase.rpc("analytics_subscriptions"),
  ]);
  return {
    summary: (summary.data as unknown as DashboardSummary | null) ?? null,
    byGroup: byGroup.data ?? [],
    trend: trend.data ?? [],
    cumulative: cumulative.data ?? [],
    top: top.data ?? [],
    groupTrend: groupTrend.data ?? [],
    upcoming: upcoming.data ?? [],
    subscriptions: subscriptions.data ?? [],
  };
}

import "server-only";
import { cookies } from "next/headers";
import { sumMoney } from "@/lib/money";
import { createClient } from "@/utils/supabase/server";

const client = async () => createClient(await cookies());

export type TipSeverity = "save" | "warn" | "info";

export type TipView = {
  id: string;
  code: string;
  severity: TipSeverity;
  params: Record<string, unknown>;
  /** becsült havi megtakarítás (SQL); a „kb." jelölést a UI adja */
  est: number | null;
  reminderIds: string[];
  status: string;
};

const asSeverity = (s: string): TipSeverity => (s === "save" || s === "warn" ? s : "info");

const toView = (t: { id: string; code: string; severity: string; params: unknown; est_monthly_saving: number | null; reminder_ids: string[]; status: string }): TipView => ({
  id: t.id,
  code: t.code,
  severity: asSeverity(t.severity),
  params: t.params && typeof t.params === "object" && !Array.isArray(t.params) ? (t.params as Record<string, unknown>) : {},
  est: t.est_monthly_saving,
  reminderIds: t.reminder_ids,
  status: t.status,
});

const COLUMNS = "id, code, severity, params, est_monthly_saving, reminder_ids, status";

// Az aktív tippek: új / megnyitott, és a lejárt halasztásúak (RLS: csak a sajátjaid); a legnagyobb becsült megtakarítás elöl
export async function getActiveTips(today: string): Promise<TipView[]> {
  const { data } = await (await client())
    .from("tips")
    .select(COLUMNS)
    .or(`status.in.(new,seen),and(status.eq.snoozed,snoozed_until.lte.${today})`)
    .order("est_monthly_saving", { ascending: false, nullsFirst: false });
  return (data ?? []).map(toView);
}

// A dashboardra: egyetlen tipp (a legnagyobb becsült megtakarítású)
export async function getTopTip(today: string): Promise<TipView | null> {
  const { data } = await (await client())
    .from("tips")
    .select(COLUMNS)
    .or(`status.in.(new,seen),and(status.eq.snoozed,snoozed_until.lte.${today})`)
    .order("est_monthly_saving", { ascending: false, nullsFirst: false })
    .limit(1);
  return data?.[0] ? toView(data[0]) : null;
}

// „Megcsináltad": a kész tippek becsült havi megtakarítása (centre pontos összeg)
export async function getDoneSaving(): Promise<number> {
  const { data } = await (await client()).from("tips").select("est_monthly_saving").eq("status", "done").not("est_monthly_saving", "is", null);
  return sumMoney((data ?? []).map((t) => t.est_monthly_saving ?? 0));
}

export async function getTipsEnabled(userId: string): Promise<boolean> {
  const { data } = await (await client()).from("profiles").select("tips_enabled").eq("id", userId).single();
  return data?.tips_enabled ?? true;
}

// A „Mit nézel itt?" chipekhez: az emlékeztető mostani használati címkéi
export async function getUsageTags(reminderIds: string[]): Promise<Map<string, string[]>> {
  if (reminderIds.length === 0) return new Map();
  const { data } = await (await client()).from("reminders").select("id, usage_tags").in("id", reminderIds);
  return new Map((data ?? []).map((r) => [r.id, r.usage_tags]));
}

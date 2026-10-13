import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

const DETAIL_COLUMNS =
  "id, name, amount, currency, category_id, service_slug, is_subscription, recur_unit, recur_every, start_date, month_end, end_date, trial_ends_on, remind_enabled, remind_offsets, remind_time, channels, auto_paid, note, url, is_active, is_demo";

export type HistoryRow = {
  occurrence_id: string;
  due_date: string;
  status: string;
  amount: number;
  currency: string;
  paid_on: string | null;
  paid_amount: number | null;
  prev_amount: number | null;
  /** az előző esedékességhez képesti változás %-ban (SQL számolja, H9) */
  change_pct: number | null;
  overdue: boolean;
};

// Az emlékeztető + az esedékességek előzménye árváltozás-jelzéssel (A-31 reminder_history)
export async function getReminderDetail(id: string) {
  const supabase = createClient(await cookies());
  const [reminder, history] = await Promise.all([
    supabase.from("reminders").select(DETAIL_COLUMNS).eq("id", id).maybeSingle(),
    supabase.rpc("reminder_history", { p_reminder_id: id, p_limit: 36 }),
  ]);
  return { reminder: reminder.data, history: (history.data ?? []) as HistoryRow[] };
}

// A következő (legkorábbi) ki nem fizetett esedékesség: az előzmény dátum szerint csökkenő, ezért a legkisebb dátumú "upcoming"
export function nextOccurrence(history: HistoryRow[]): HistoryRow | null {
  const upcoming = history.filter((h) => h.status === "upcoming");
  return upcoming.reduce<HistoryRow | null>((best, h) => (best === null || h.due_date < best.due_date ? h : best), null);
}

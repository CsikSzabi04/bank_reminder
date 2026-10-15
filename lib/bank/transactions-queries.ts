import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import {
  monthBounds,
  parseTransactions,
  searchTerm,
  TX_COLUMNS,
  TX_PAGE_SIZE,
  type BankTx,
  type TxFilters,
} from "./transactions";

export type TxLinks = {
  // esedékesség azonosító → { emlékeztető azonosító, név }
  bills: Map<string, { reminderId: string; name: string }>;
  // befizetés azonosító → { cél azonosító, név }
  savings: Map<string, { goalId: string; name: string }>;
};

export type TransactionsData =
  | { available: false }
  | { available: true; items: BankTx[]; total: number; links: TxLinks; hasAny: boolean };

// Ha a banki szinkron oszlopai (A-48) valahol még hiányoznának (pl. egy `db:push` előtti környezet), a lekérdezés `42703`-mal
// (nincs ilyen oszlop) elbukik, és a szakasz „még nem elérhető" állapotot mutat, nem hibaoldalt.
const MISSING_COLUMN = new Set(["42703", "PGRST204"]);

const ids = (values: (string | null)[]): string[] => [...new Set(values.filter((v): v is string => Boolean(v)))];

// A felhasználó banki tételei (az RLS a sajátokra szűr), újabb elöl, lapozva; oszlopok felsorolva (oszlop-szintű jogok)
export const getTransactions = cache(async (filters: TxFilters): Promise<TransactionsData> => {
  const supabase = createClient(await cookies());
  const from = (filters.page - 1) * TX_PAGE_SIZE;

  let query = supabase
    .from("bank_transactions")
    .select(TX_COLUMNS, { count: "exact" })
    .order("booked_on", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, from + TX_PAGE_SIZE - 1);
  if (filters.account) query = query.eq("account_ref", filters.account);
  if (filters.direction !== "all") query = query.eq("direction", filters.direction);
  if (filters.month) {
    const { from: start, to } = monthBounds(filters.month);
    query = query.gte("booked_on", start).lte("booked_on", to);
  }
  const term = filters.q ? searchTerm(filters.q) : "";
  if (term) query = query.or(`counterparty.ilike.%${term}%,merchant.ilike.%${term}%,remittance.ilike.%${term}%`);

  const { data, error, count } = await query;
  if (error) {
    if (error.code && MISSING_COLUMN.has(error.code)) return { available: false };
    throw new Error(`bank_transactions_query_failed:${error.code ?? "unknown"}`);
  }
  const items = parseTransactions(data);

  // a „mit lett belőle" nevei: kifizetett számla (emlékeztető-név) és megtakarítási cél
  const occurrenceIds = ids(items.map((t) => t.occurrenceId));
  const contributionIds = ids(items.map((t) => t.contributionId));
  const [occurrences, contributions] = await Promise.all([
    occurrenceIds.length ? supabase.from("v_occurrences").select("id, reminder_id, reminder_name").in("id", occurrenceIds) : null,
    contributionIds.length ? supabase.from("goal_contributions").select("id, goal_id").in("id", contributionIds) : null,
  ]);
  const goalIds = ids((contributions?.data ?? []).map((c) => c.goal_id));
  const goals = goalIds.length ? await supabase.from("savings_goals").select("id, name").in("id", goalIds) : null;

  const goalName = new Map((goals?.data ?? []).map((g) => [g.id, g.name]));
  const links: TxLinks = {
    bills: new Map(
      (occurrences?.data ?? []).flatMap((o) => (o.id && o.reminder_id ? [[o.id, { reminderId: o.reminder_id, name: o.reminder_name ?? "" }] as const] : [])),
    ),
    savings: new Map(
      (contributions?.data ?? []).flatMap((c) => {
        const name = goalName.get(c.goal_id);
        return name === undefined ? [] : ([[c.id, { goalId: c.goal_id, name }]] as const);
      }),
    ),
  };

  // „van-e egyáltalán tétel" — a szűrt üres találat és a teljesen üres állapot más üzenetet kap
  const anyFilter = filters.account || filters.direction !== "all" || filters.month || term;
  let hasAny = (count ?? items.length) > 0;
  if (!hasAny && anyFilter) {
    const probe = await supabase.from("bank_transactions").select("id", { count: "exact", head: true });
    hasAny = !probe.error && (probe.count ?? 0) > 0;
  }
  return { available: true, items, total: count ?? items.length, links, hasAny };
});

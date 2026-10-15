import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getCategoryOptions, type CategoryOption } from "@/lib/budgets/queries";
import type { Locale } from "@/lib/i18n/config";
import { createClient } from "@/utils/supabase/server";
import {
  parsePendingTransactions,
  parseRules,
  parseUnparsedEvents,
  type MerchantRule,
  type PendingTransaction,
  type UnparsedEvent,
} from "./rules";

// A „Besorolásra vár" lista ennyi tételt mutat egyszerre (a többit a besorolás után a következő kör hozza)
export const PENDING_PAGE = 50;
const UNPARSED_PAGE = 20;

export type RulesData = {
  pending: PendingTransaction[];
  pendingTotal: number;
  rules: MerchantRule[];
  unparsed: UnparsedEvent[];
  categories: CategoryOption[];
};

// Mindent az RLS szűr a saját sorokra. Az oszlopokat felsoroljuk (oszlop-szintű jogok, H11).
export const getRulesData = cache(async (locale: Locale): Promise<RulesData> => {
  const supabase = createClient(await cookies());
  const [pending, rules, unparsed, categories] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select("id, source, status, amount, currency, booked_on, merchant, merchant_key", { count: "exact" })
      .is("category_id", null)
      .eq("dismissed", false)
      .order("booked_on", { ascending: false })
      .limit(PENDING_PAGE),
    supabase.from("merchant_rules").select("id, user_id, match_key, category_id, hits").order("created_at", { ascending: true }),
    supabase
      .from("ingest_events")
      .select("id, app, at, raw_text")
      .eq("outcome", "unparsed")
      .not("raw_text", "is", null)
      .order("at", { ascending: false })
      .limit(UNPARSED_PAGE),
    getCategoryOptions(locale),
  ]);
  for (const result of [pending, rules, unparsed]) {
    if (result.error) throw new Error(`bank_rules_query_failed:${result.error.code ?? "unknown"}`);
  }
  return {
    pending: parsePendingTransactions(pending.data),
    pendingTotal: pending.count ?? pending.data?.length ?? 0,
    rules: parseRules(rules.data),
    unparsed: parseUnparsedEvents(unparsed.data),
    // a besoroláshoz kiadás-kategóriák valók (a számla-kategóriák nem)
    categories: categories.filter((c) => c.kind === "expense" || c.kind === "both"),
  };
});

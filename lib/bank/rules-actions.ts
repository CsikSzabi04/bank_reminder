"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState, ErrorCode } from "@/lib/action-state";
import { createClient } from "@/utils/supabase/server";
import {
  classifyTransactionCore,
  deleteRuleCore,
  dismissTransactionCore,
  saveRuleCore,
  type RulesError,
} from "./rules-service";

// A UI a `reason` (RulesError) alapján lokalizál; az `ErrorCode` a közös alak (§21.6)
const GENERIC: Partial<Record<RulesError, ErrorCode>> = { not_found: "not_found", duplicate: "conflict", key_too_short: "validation", key_too_long: "validation", no_merchant_key: "validation" };
const fail = (reason: RulesError): ActionState<never> => ({ ok: false, code: GENERIC[reason] ?? "upstream_failed", reason });

const id = z.uuid();

// A besorolás a kereteket, a Főoldalt és az analitikát is érinti; a bank-oldal listái is frissülnek
function refresh() {
  revalidatePath("/bank");
  revalidatePath("/budgets", "layout");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");
}

async function session() {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  return auth?.claims?.sub ? supabase : null;
}

// Besorolás; `remember` = „Ezt mindig így": szabály + a várakozó, azonos kereskedős tételek is
export async function classifyBankTransaction(input: { transactionId: string; categoryId: string; remember: boolean }): Promise<ActionState<{ classified: number }>> {
  const parsed = z.object({ transactionId: id, categoryId: id, remember: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const res = await classifyTransactionCore(supabase, parsed.data);
  if (!res.ok) return fail(res.code);
  refresh();
  return { ok: true, data: res.data };
}

export async function dismissBankTransaction(transactionId: string): Promise<ActionState> {
  if (!id.safeParse(transactionId).success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const res = await dismissTransactionCore(supabase, transactionId);
  if (!res.ok) return fail(res.code);
  refresh();
  return { ok: true };
}

export async function saveMerchantRule(input: { id?: string; matchKey: string; categoryId: string }): Promise<ActionState<{ id: string }>> {
  const parsed = z.object({ id: id.optional(), matchKey: z.string().max(200), categoryId: id }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const res = await saveRuleCore(supabase, parsed.data);
  if (!res.ok) return fail(res.code);
  revalidatePath("/bank");
  return { ok: true, data: res.data };
}

export async function deleteMerchantRule(ruleId: string): Promise<ActionState> {
  if (!id.safeParse(ruleId).success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const res = await deleteRuleCore(supabase, ruleId);
  if (!res.ok) return fail(res.code);
  revalidatePath("/bank");
  return { ok: true };
}

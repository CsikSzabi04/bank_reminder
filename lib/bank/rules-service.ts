import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { checkRuleKey } from "./rules";

// A „Besorolásra vár" és a szabály-szerkesztő magja (advanced.md §8.4): injektált klienssel, hogy fake-kel tesztelhető legyen.
// A besorolás/elvetés atomi RPC (A-42); a szabály-CRUD közvetlen, a saját sorokon (A-41 oszlop-jogok + RLS).
type Db = SupabaseClient<Database>;

export type RulesError = "not_found" | "no_merchant_key" | "key_too_short" | "key_too_long" | "duplicate" | "failed";
export type RulesResult<T> = { ok: true; data: T } | { ok: false; code: RulesError };

const failed = { ok: false, code: "failed" } as const;
const notFound = { ok: false, code: "not_found" } as const;

// A besorolás és az elvetés atomi RPC (A-42, `security invoker`: az RLS és az oszlop-jogok érvényesek): egy függvény = egy tranzakció,
// hiba esetén nincs részleges írás. A SQLSTATE → B-kód leképezés a szerződés szerint: BR404 → not_found, BR422 → no_merchant_key.
function mapRpcError(error: { code?: string } | null): RulesResult<never> {
  if (error?.code === "BR404") return notFound;
  if (error?.code === "BR422") return { ok: false, code: "no_merchant_key" };
  return failed;
}

// `remember` = „Ezt mindig így": a szerver a tétel `merchant_key`-éből saját szabályt készít (vagy frissíti), és a várakozó,
// azonos kereskedőt tartalmazó tételeket (≤ 200) is besorolja
export async function classifyTransactionCore(
  db: Db,
  input: { transactionId: string; categoryId: string; remember: boolean },
): Promise<RulesResult<{ classified: number }>> {
  const { data, error } = await db.rpc("classify_bank_transaction", {
    p_transaction: input.transactionId,
    p_category: input.categoryId,
    p_remember: input.remember,
  });
  if (error) return mapRpcError(error);
  const classified = (data as { classified?: unknown } | null)?.classified;
  return typeof classified === "number" && Number.isFinite(classified) ? { ok: true, data: { classified } } : failed;
}

// „Ez nem kiadás": a kiadás törlődik (a tombstone a főkönyvi sort `dismissed`-re állítja, így nem tér vissza)
export async function dismissTransactionCore(db: Db, transactionId: string): Promise<RulesResult<null>> {
  const { error } = await db.rpc("dismiss_bank_transaction", { p_transaction: transactionId });
  return error ? mapRpcError(error) : { ok: true, data: null };
}

export async function saveRuleCore(db: Db, input: { id?: string; matchKey: string; categoryId: string }): Promise<RulesResult<{ id: string }>> {
  const check = checkRuleKey(input.matchKey);
  if (!check.ok) return { ok: false, code: check.reason === "tooShort" ? "key_too_short" : "key_too_long" };

  if (input.id) {
    const { data, error } = await db.from("merchant_rules").update({ match_key: check.key, category_id: input.categoryId }).eq("id", input.id).select("id");
    if (error) return error.code === "23505" ? { ok: false, code: "duplicate" } : failed;
    // a rendszer-szabályhoz és idegen sorhoz nincs írási jog → az RLS nulla sort ad vissza
    return data && data.length > 0 ? { ok: true, data: { id: data[0].id } } : notFound;
  }
  const { data, error } = await db.from("merchant_rules").insert({ match_key: check.key, category_id: input.categoryId }).select("id").single();
  if (error) return error.code === "23505" ? { ok: false, code: "duplicate" } : failed;
  return { ok: true, data: { id: data.id } };
}

export async function deleteRuleCore(db: Db, ruleId: string): Promise<RulesResult<null>> {
  const { data, error } = await db.from("merchant_rules").delete().eq("id", ruleId).select("id");
  if (error) return failed;
  return data && data.length > 0 ? { ok: true, data: null } : notFound;
}

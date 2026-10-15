import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { checkRuleKey, MATCH_KEY_MIN } from "./rules";

// A „Besorolásra vár" és a szabály-szerkesztő magja (advanced.md §8.4): injektált klienssel, hogy fake-kel tesztelhető legyen.
// A kliens-jogok (A-41): bank_transactions csak category_id/dismissed írható, merchant_rules a sajátokon CRUD, expenses saját sorra.
type Db = SupabaseClient<Database>;

export type RulesError = "not_found" | "no_merchant_key" | "key_too_short" | "key_too_long" | "duplicate" | "failed";
export type RulesResult<T> = { ok: true; data: T } | { ok: false; code: RulesError };

const failed = { ok: false, code: "failed" } as const;
const notFound = { ok: false, code: "not_found" } as const;

// A „Ezt mindig így" egyszerre ennyi másik, azonos kereskedős függő tételt sorol be (a többit a következő koppintás viszi)
export const RETRO_APPLY_LIMIT = 200;

// Egy tétel besorolása: ELŐSZÖR a kiadás (a keretek ebből számolnak), UTÁNA a főkönyvi sor. Ha a második lépés elbukik, a tétel
// a „Besorolásra vár" listán marad, és az ismétlés (idempotens) helyreállítja — fordított sorrendnél a tétel eltűnne a listáról
// besorolatlan kiadással.
async function setCategory(db: Db, tx: { id: string; expense_id: string | null }, categoryId: string): Promise<boolean> {
  if (tx.expense_id) {
    const { error } = await db.from("expenses").update({ category_id: categoryId }).eq("id", tx.expense_id);
    if (error) return false;
  }
  const { error } = await db.from("bank_transactions").update({ category_id: categoryId }).eq("id", tx.id);
  return !error;
}

export async function classifyTransactionCore(
  db: Db,
  input: { transactionId: string; categoryId: string; remember: boolean },
): Promise<RulesResult<{ classified: number }>> {
  const found = await db.from("bank_transactions").select("id, expense_id, merchant_key, dismissed").eq("id", input.transactionId).maybeSingle();
  if (found.error) return failed;
  const tx = found.data;
  if (!tx || tx.dismissed) return notFound;

  // szabály csak kereskedő-névből készülhet: előbb ellenőrizzük, hogy a besorolás ne járjon félig
  const key = input.remember ? tx.merchant_key : null;
  if (input.remember && (!key || key.length < MATCH_KEY_MIN)) return { ok: false, code: "no_merchant_key" };

  if (!(await setCategory(db, tx, input.categoryId))) return failed;
  let classified = 1;
  if (!key) return { ok: true, data: { classified } };

  // a szabály: ha a felhasználónak már van ilyen kulcsa, a kategóriája frissül; különben új
  const own = await db.from("merchant_rules").select("id").eq("match_key", key).not("user_id", "is", null).maybeSingle();
  if (own.error) return failed;
  const saved = own.data
    ? await db.from("merchant_rules").update({ category_id: input.categoryId }).eq("id", own.data.id)
    : await db.from("merchant_rules").insert({ match_key: key, category_id: input.categoryId });
  if (saved.error) return failed;

  // a már várakozó, azonos kereskedős tételek is besorolódnak (a szabály „tartalmazza"-szemantikájával, mint a szerveren)
  const pending = await db
    .from("bank_transactions")
    .select("id, expense_id")
    .is("category_id", null)
    .eq("dismissed", false)
    .like("merchant_key", `%${key}%`)
    .neq("id", tx.id)
    .limit(RETRO_APPLY_LIMIT);
  if (pending.error) return failed;
  for (const other of pending.data ?? []) if (await setCategory(db, other, input.categoryId)) classified += 1;
  return { ok: true, data: { classified } };
}

// „Ez nem kiadás": a kiadás törlődik (a tombstone-trigger a főkönyvi sort `dismissed`-re állítja, így nem tér vissza), és a sor
// akkor is `dismissed` lesz, ha nem tartozott hozzá kiadás.
export async function dismissTransactionCore(db: Db, transactionId: string): Promise<RulesResult<null>> {
  const found = await db.from("bank_transactions").select("id, expense_id").eq("id", transactionId).maybeSingle();
  if (found.error) return failed;
  if (!found.data) return notFound;
  if (found.data.expense_id) {
    const { error } = await db.from("expenses").delete().eq("id", found.data.expense_id);
    if (error) return failed;
  }
  const { error } = await db.from("bank_transactions").update({ dismissed: true }).eq("id", transactionId);
  return error ? failed : { ok: true, data: null };
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

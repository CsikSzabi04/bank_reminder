import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// Mely esedékességeket fizette ki a bankszámláról érkezett tétel (A-48: `bank_transactions.occurrence_id`): esedékesség-azonosító → a banki
// tétel könyvelési napja. Nem kritikus adat: ha az oszlop még nincs a DB-ben (a szinkron élesítése előtt) vagy a lekérdezés hibás,
// üres térkép — az oldal ettől nem romlik el.
export async function getBankPaidOccurrences(occurrenceIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(occurrenceIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const supabase = createClient(await cookies());
  const { data, error } = await supabase
    .from("bank_transactions")
    .select("occurrence_id, booked_on")
    .in("occurrence_id", ids)
    .not("occurrence_id", "is", null);
  if (error) return new Map();
  const map = new Map<string, string>();
  // az `occurrence_id` a `db:types` után lesz típusos; addig a sorokat szűk, kézi alakra olvassuk
  for (const row of (data ?? []) as unknown as { occurrence_id?: unknown; booked_on?: unknown }[]) {
    if (typeof row.occurrence_id === "string" && typeof row.booked_on === "string" && !map.has(row.occurrence_id)) map.set(row.occurrence_id, row.booked_on);
  }
  return map;
}

import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// A szerkesztő űrlap előtöltéséhez: az emlékeztető / megtakarítási cél kulcsszava. Külön, tűrő lekérdezés: az oszlop a `db:push` előtt
// még nincs a DB-ben, és a közös lekérdezéseket (lista, részlet) nem szabad emiatt elrontani. Hiba / hiányzó oszlop → üres.
export async function getBankMatch(table: "reminders" | "savings_goals", id: string): Promise<string> {
  const supabase = createClient(await cookies());
  const { data, error } = await supabase.from(table).select("bank_match").eq("id", id).maybeSingle();
  if (error || !data) return "";
  const value = (data as unknown as { bank_match?: unknown }).bank_match;
  return typeof value === "string" ? value : "";
}

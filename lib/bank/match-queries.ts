import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

// A szerkesztő űrlap előtöltéséhez: az emlékeztető / megtakarítási cél kulcsszava. Külön, tűrő lekérdezés: a közös lekérdezéseket
// (lista, részlet) nem terheli, és hiba esetén az űrlap üres mezővel nyílik (nem romlik el).
export async function getBankMatch(table: "reminders" | "savings_goals", id: string): Promise<string> {
  const supabase = createClient(await cookies());
  const { data, error } =
    table === "reminders"
      ? await supabase.from("reminders").select("bank_match").eq("id", id).maybeSingle()
      : await supabase.from("savings_goals").select("bank_match").eq("id", id).maybeSingle();
  if (error || !data) return "";
  return data.bank_match ?? "";
}

import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { interpretBankAccess, type BankAccess } from "./access";

// Kérésenként egyszer fut. Külön a getCurrentProfile-tól: ha az oszlop még nincs a DB-ben (A-41 előtt),
// a közös profil-lekérdezés nem borulhat el miatta — az egész alkalmazás azt használja.
export const getBankAccess = cache(async (): Promise<BankAccess> => {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { syncAllowed: false };

  // Az A-41 utáni típus-újragenerálásig az oszlop nincs a database.types.ts-ben → a találat típusa nem használható
  const { data, error } = await supabase.from("profiles").select("bank_sync_allowed").eq("id", userId).single();
  return interpretBankAccess({ data, error });
});

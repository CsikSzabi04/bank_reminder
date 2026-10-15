import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { interpretBankAccess, type BankAccess } from "./access";
import { BANK_CONNECTION_COLUMNS, parseConnections } from "./connections";
import { listAspspsCore } from "./service";
import type { Aspsp, BankConnection, BankErrorCode } from "./types";

// Az A-41 utáni típus-újragenerálásig a bank-oszlopok/táblák nincsenek a database.types.ts-ben → szűk, kézi alakok

// Kérésenként egyszer fut. Külön a getCurrentProfile-tól: ha az oszlop még nincs a DB-ben (A-41 előtt),
// a közös profil-lekérdezés nem borulhat el miatta — az egész alkalmazás azt használja.
export const getBankAccess = cache(async (): Promise<BankAccess> => {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { syncAllowed: false };

  const { data, error } = await supabase.from("profiles").select("bank_sync_allowed").eq("id", userId).single();
  return interpretBankAccess({ data, error });
});

type ConnectionsQuery = {
  from: (table: string) => {
    select: (columns: string) => {
      order: (column: string, options: { ascending: boolean }) => Promise<{ data: unknown; error: { code?: string } | null }>;
    };
  };
};

// A felhasználó kapcsolatai (az RLS a sajátokra szűr); csak az Enable-jogosultsággal rendelkező hívja
export const getBankConnections = cache(async (): Promise<BankConnection[]> => {
  const supabase = createClient(await cookies()) as unknown as ConnectionsQuery;
  const { data, error } = await supabase.from("bank_connections").select(BANK_CONNECTION_COLUMNS).order("created_at", { ascending: false });
  if (error) throw new Error(`bank_connections_query_failed:${error.code ?? "unknown"}`);
  return parseConnections(data);
});

// A választható bankok (Edge `list-aspsps`); a hiba nem dönti el az oldalt: az összekötő panel hibaüzenetet mutat
export const getAspsps = cache(async (): Promise<{ ok: true; banks: Aspsp[] } | { ok: false; code: BankErrorCode }> => {
  const supabase = createClient(await cookies());
  const res = await listAspspsCore(supabase, "HU");
  if (!res.ok) return res;
  return { ok: true, banks: [...res.data].sort((a, b) => a.name.localeCompare(b.name, "hu")) };
});

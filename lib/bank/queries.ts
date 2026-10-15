import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { interpretBankAccess, type BankAccess } from "./access";
import { BANK_CONNECTION_COLUMNS, parseConnections } from "./connections";
import { listAspspsCore } from "./service";
import type { Aspsp, BankConnection, BankErrorCode } from "./types";

// Kérésenként egyszer fut. Külön a getCurrentProfile-tól: a bank-kapu hibája (pl. oszlop-jog változás) ne vigye el
// az egész alkalmazást — a közös profil-lekérdezést minden oldal használja.
export const getBankAccess = cache(async (): Promise<BankAccess> => {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  const userId = auth?.claims?.sub;
  if (!userId) return { syncAllowed: false };

  const { data, error } = await supabase.from("profiles").select("bank_sync_allowed").eq("id", userId).single();
  return interpretBankAccess({ data, error });
});

// A felhasználó kapcsolatai (az RLS a sajátokra szűr); csak az Enable-jogosultsággal rendelkező hívja
export const getBankConnections = cache(async (): Promise<BankConnection[]> => {
  const supabase = createClient(await cookies());
  // az oszlopokat fel kell sorolni: a `session_id` és társai oszlop-szintű jog miatt a kliensnek nem láthatók (select * hibára futna)
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

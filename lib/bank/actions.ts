"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState, ErrorCode } from "@/lib/action-state";
import { createClient } from "@/utils/supabase/server";
import { getBankAccess } from "./queries";
import { disconnectCore, parseRefreshOutcome, startConnectionCore, type RefreshOutcome } from "./service";
import type { BankErrorCode } from "./types";

// A UI a `reason` (BankErrorCode) alapján lokalizál; az `ErrorCode` a közös alak (§21.6)
const GENERIC: Partial<Record<BankErrorCode, ErrorCode>> = {
  unauthenticated: "unauthenticated",
  not_allowed: "forbidden",
  not_found: "not_found",
  rate_limited: "rate_limited",
};
const fail = (reason: BankErrorCode): ActionState<never> => ({ ok: false, code: GENERIC[reason] ?? "upstream_failed", reason });

// Minden művelet előtt: bejelentkezés + Enable-jogosultság (az Edge Function is ellenőrzi — ez csak a barátságos, korai hiba)
async function guard(): Promise<{ ok: true; supabase: ReturnType<typeof createClient> } | { ok: false; state: ActionState<never> }> {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) return { ok: false, state: fail("unauthenticated") };
  if (!(await getBankAccess()).syncAllowed) return { ok: false, state: fail("not_allowed") };
  return { ok: true, supabase };
}

// Összekötés / újra-hitelesítés indítása: visszaadja a bank átirányító URL-jét, a böngésző megy rá (a state-et a szerver adja és őrzi)
export async function startBankConnection(input: {
  aspspName: string;
  aspspCountry: string;
  renewConnectionId?: string;
}): Promise<ActionState<{ url: string }>> {
  const g = await guard();
  if (!g.ok) return g.state;
  const res = await startConnectionCore(g.supabase, input);
  return res.ok ? { ok: true, data: res.data } : fail(res.code);
}

export async function disconnectBank(connectionId: string): Promise<ActionState> {
  const g = await guard();
  if (!g.ok) return g.state;
  const res = await disconnectCore(g.supabase, connectionId);
  if (!res.ok) return fail(res.code);
  revalidatePath("/bank");
  return { ok: true };
}

const idSchema = z.uuid();

// „Frissítés most": a 12 órás / napi 2 korlátot a szerver (request_bank_sync) tartja, itt csak közvetítünk
export async function refreshBankNow(connectionId: string): Promise<ActionState<RefreshOutcome>> {
  const id = idSchema.safeParse(connectionId);
  if (!id.success) return fail("not_found");
  const g = await guard();
  if (!g.ok) return g.state;
  // A request_bank_sync az A-48-ban érkezik, így még nincs a generált típusban
  const rpc = g.supabase.rpc.bind(g.supabase) as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { code?: string } | null }>;
  const { data, error } = await rpc("request_bank_sync", { p_connection_id: id.data });
  if (error) {
    console.error("request_bank_sync failed", { code: error.code ?? "unknown" });
    // PGRST202 / 42883: a függvény még nincs telepítve (a szinkron az A-48-cal érkezik) → nem „a bank nem válaszol", hanem „még nem elérhető"
    if (error.code === "PGRST202" || error.code === "42883") return fail("unavailable");
    return fail(error.code === "P0002" ? "not_found" : "upstream_failed");
  }
  const outcome = parseRefreshOutcome(data);
  if (!outcome) return fail("upstream_failed");
  revalidatePath("/bank");
  return { ok: true, data: outcome };
}

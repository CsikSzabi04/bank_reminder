"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState, ErrorCode } from "@/lib/action-state";
import { createClient } from "@/utils/supabase/server";
import { parseIngestEvents, type IngestEvent } from "./ingest";
import {
  createTokenCore,
  regenerateTokenCore,
  revokeTokenCore,
  setAppsCore,
  type CreatedToken,
  type IngestError,
  type IngestRpcClient,
} from "./ingest-service";

// A UI a `reason` (IngestError) alapján lokalizál; az `ErrorCode` a közös alak (§21.6)
const GENERIC: Partial<Record<IngestError, ErrorCode>> = {
  invalid_apps: "validation",
  too_many_apps: "validation",
  apps_too_long: "validation",
  label_too_long: "validation",
  not_found: "not_found",
  limit_reached: "limit_reached",
};
const fail = (reason: IngestError): ActionState<never> => ({ ok: false, code: GENERIC[reason] ?? "upstream_failed", reason });

const id = z.uuid();

// Az Android-szakasz mindenkinek elérhető (nincs `bank_sync_allowed` kapu): elég a bejelentkezés
async function session() {
  const supabase = createClient(await cookies());
  const { data: auth } = await supabase.auth.getClaims();
  return auth?.claims?.sub ? supabase : null;
}
const rpcOf = (supabase: NonNullable<Awaited<ReturnType<typeof session>>>) => supabase as unknown as IngestRpcClient;

// A nyers token a válaszban egyszer utazik a böngészőnek; az oldal újratöltésekor már nincs meg (csak a hash él a szerveren)
export async function createIngestToken(input: { label: string; apps: string[] }): Promise<ActionState<CreatedToken>> {
  const parsed = z.object({ label: z.string().max(200), apps: z.array(z.string().max(300)).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const res = await createTokenCore(rpcOf(supabase), parsed.data);
  if (!res.ok) return fail(res.code);
  revalidatePath("/bank");
  return { ok: true, data: res.data };
}

export async function revokeIngestToken(tokenId: string): Promise<ActionState> {
  if (!id.safeParse(tokenId).success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const res = await revokeTokenCore(rpcOf(supabase), tokenId);
  if (!res.ok) return fail(res.code);
  revalidatePath("/bank");
  return { ok: true };
}

// Újragenerálás: a címkét és az engedélyezett appokat a SZERVER olvassa ki a tokenből (RLS: csak a sajátot látja), nem a kliens küldi
export async function regenerateIngestToken(tokenId: string): Promise<ActionState<CreatedToken & { oldRevoked: boolean }>> {
  if (!id.safeParse(tokenId).success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const found = await supabase.from("ingest_tokens").select("id, label, allowed_apps").eq("id", tokenId).is("revoked_at", null).maybeSingle();
  if (found.error) return fail("failed");
  if (!found.data) return fail("not_found");
  const res = await regenerateTokenCore(rpcOf(supabase), { id: found.data.id, label: found.data.label ?? "", apps: found.data.allowed_apps });
  if (!res.ok) return fail(res.code);
  revalidatePath("/bank");
  return { ok: true, data: res.data };
}

export async function saveIngestApps(input: { id: string; apps: string[] }): Promise<ActionState<{ apps: string[] }>> {
  const parsed = z.object({ id, apps: z.array(z.string().max(300)).max(100) }).safeParse(input);
  if (!parsed.success) return { ok: false, code: "validation" };
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };
  const res = await setAppsCore(rpcOf(supabase), parsed.data.id, parsed.data.apps);
  if (!res.ok) return fail(res.code);
  revalidatePath("/bank");
  return { ok: true, data: res.data };
}

export type ParsedLine = { merchant: string | null; amount: number; currency: string };
export type PollResult = { events: IngestEvent[]; parsed: ParsedLine | null };

// Teszt-várakozás: az adott időpont óta érkezett események (PII-mentes napló: app + kimenet) és — ha felvétel történt —
// a legfrissebb értesítés-eredetű tétel (összeg, pénznem, kereskedő: a felhasználó SAJÁT adata a saját felületén).
// Az `since` legfeljebb 10 percre nyúlhat vissza, hogy a lekérdezés ne legyen tetszőleges előzmény-olvasó.
export async function pollIngestEvents(sinceIso: string): Promise<ActionState<PollResult>> {
  const since = Date.parse(sinceIso);
  if (Number.isNaN(since)) return { ok: false, code: "validation" };
  const floor = Date.now() - 10 * 60_000;
  const from = new Date(Math.max(since, floor)).toISOString();
  const supabase = await session();
  if (!supabase) return { ok: false, code: "unauthenticated" };

  const events = await supabase.from("ingest_events").select("id, app, outcome, at").gte("at", from).order("at", { ascending: false }).limit(5);
  if (events.error) return fail("failed");
  const list = parseIngestEvents(events.data);

  let parsed: ParsedLine | null = null;
  if (list.some((e) => e.outcome === "recorded")) {
    const tx = await supabase
      .from("bank_transactions")
      .select("merchant, amount, currency")
      .eq("source", "notification")
      .gte("created_at", from)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (tx.data) parsed = { merchant: tx.data.merchant, amount: tx.data.amount, currency: tx.data.currency };
  }
  return { ok: true, data: { events: list, parsed } };
}

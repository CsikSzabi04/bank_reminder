import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { createClient } from "@/utils/supabase/server";
import { parseIngestEvents, parseIngestTokens, recentApps, type IngestEvent, type IngestToken } from "./ingest";
import type { IngestRpcClient } from "./ingest-service";

export type IngestOverview =
  | { available: false }
  | { available: true; tokens: IngestToken[]; events: IngestEvent[]; suggestions: string[] };

const EVENT_PAGE = 30;

// Az Android-szakasz adatai. A `list_ingest_tokens` (A-44) egyben a „van-e már szerver-oldal" próba is: ha a függvény még nincs
// telepítve (PGRST202 / 42883), az oldal a „hamarosan" állapotot mutatja, nem egy törött felületet. Más hiba → error boundary.
export const getIngestOverview = cache(async (): Promise<IngestOverview> => {
  const supabase = createClient(await cookies());
  const list = await (supabase as unknown as IngestRpcClient).rpc("list_ingest_tokens");
  if (list.error) {
    if (list.error.code === "PGRST202" || list.error.code === "42883") return { available: false };
    throw new Error(`ingest_tokens_query_failed:${list.error.code ?? "unknown"}`);
  }
  // csak a PII-mentes mezők (a nyers szöveget itt nem kérjük)
  const events = await supabase.from("ingest_events").select("id, app, outcome, at").order("at", { ascending: false }).limit(EVENT_PAGE);
  if (events.error) throw new Error(`ingest_events_query_failed:${events.error.code ?? "unknown"}`);
  const tokens = parseIngestTokens(list.data);
  const parsedEvents = parseIngestEvents(events.data);
  const allowed = tokens.filter((t) => t.revokedAt === null).flatMap((t) => t.allowedApps);
  return { available: true, tokens, events: parsedEvents, suggestions: recentApps(parsedEvents, allowed) };
});

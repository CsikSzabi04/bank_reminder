import "server-only";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";

export const NEWS_PAGE_SIZE = 12;
export const NEWS_TOPICS = ["deals", "prices", "utilities", "banking", "saving"] as const;
export type NewsTopic = (typeof NEWS_TOPICS)[number];

export function resolveTopic(param: string | undefined): NewsTopic | undefined {
  return (NEWS_TOPICS as readonly string[]).includes(param ?? "") ? (param as NewsTopic) : undefined;
}

export type NewsItem = {
  id: string;
  sourceKey: string;
  sourceName: string;
  url: string;
  title: string;
  snippet: string;
  imageUrl: string | null;
  topic: string;
  publishedAt: string;
  expiresAt: string;
  freshness: "fresh" | "normal" | "stale";
};

type Row = {
  id: string;
  source_key: string;
  source_name: string;
  url: string;
  title: string;
  snippet: string;
  image_url: string | null;
  topic: string;
  published_at: string;
  expires_at: string;
  freshness: string;
};

const asFreshness = (f: string): NewsItem["freshness"] => (f === "fresh" || f === "stale" ? f : "normal");

const toItem = (r: Row): NewsItem => ({
  id: r.id,
  sourceKey: r.source_key,
  sourceName: r.source_name,
  url: r.url,
  title: r.title,
  snippet: r.snippet,
  imageUrl: r.image_url,
  topic: r.topic,
  publishedAt: r.published_at,
  expiresAt: r.expires_at,
  freshness: asFreshness(r.freshness),
});

export type Cursor = { publishedAt: string; id: string };

// Hírek CSAK az RPC-n át (a kikapcsolt forrás / elrejtett / lejárt tétel azonnal eltűnik); kurzor = az utolsó sor (published_at, id)
export async function getNewsFeed(topic: NewsTopic | undefined, cursor?: Cursor, limit = NEWS_PAGE_SIZE): Promise<{ items: NewsItem[]; failed: boolean }> {
  const { data, error } = await (await createClient(await cookies())).rpc("news_feed", {
    p_topic: topic,
    p_limit: limit,
    p_before_published: cursor?.publishedAt,
    p_before_id: cursor?.id,
  });
  return { items: (data ?? []).map(toItem), failed: Boolean(error) };
}

export async function getNewsItem(id: string): Promise<NewsItem | null> {
  const { data } = await (await createClient(await cookies())).rpc("news_get", { p_id: id });
  return data?.[0] ? toItem(data[0]) : null;
}

export async function getNewsEnabled(userId: string): Promise<boolean> {
  const { data } = await (await createClient(await cookies())).from("profiles").select("news_enabled").eq("id", userId).single();
  return data?.news_enabled ?? true;
}

// A kiadó linkje csak https lehet (a betöltő is így szűri) — a megjelenítésnél is ellenőrizzük
export function safeExternalUrl(url: string): string | null {
  try {
    const u = new URL(url);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

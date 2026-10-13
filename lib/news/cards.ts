import "server-only";
import { getTranslations } from "next-intl/server";
import { formatAge } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { NewsItem } from "./queries";

// A kártya megjelenítési adata: szerializálható (a „Továbbiak" műveletből is ez jön), az életkort a szerver írja ki
export type NewsCardData = {
  id: string;
  title: string;
  snippet: string;
  imageUrl: string | null;
  source: string;
  age: string;
  topic: string;
  topicLabel: string;
  freshness: NewsItem["freshness"];
  freshnessLabel: string | null;
};

const TOPICS = ["deals", "prices", "utilities", "banking", "saving", "general"] as const;

export async function buildNewsCards(items: NewsItem[], locale: Locale, now = new Date()): Promise<NewsCardData[]> {
  const t = await getTranslations("news");
  const tt = await getTranslations("news.topics");
  return items.map((i) => ({
    id: i.id,
    title: i.title,
    snippet: i.snippet,
    imageUrl: i.imageUrl,
    source: i.sourceName,
    age: formatAge(i.publishedAt, now, locale),
    topic: i.topic,
    topicLabel: tt((TOPICS as readonly string[]).includes(i.topic) ? (i.topic as (typeof TOPICS)[number]) : "general"),
    freshness: i.freshness,
    freshnessLabel: i.freshness === "fresh" ? t("fresh") : i.freshness === "stale" ? t("stale") : null,
  }));
}

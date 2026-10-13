import type { Metadata } from "next";
import { ChevronLeft, ExternalLink, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { FreshnessBadge } from "@/components/news/freshness-badge";
import { NewsCard } from "@/components/news/news-card";
import { NewsImage } from "@/components/news/news-image";
import { ReportButton } from "@/components/news/report-button";
import { formatAge, formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { buildNewsCards } from "@/lib/news/cards";
import { getNewsFeed, getNewsItem, resolveTopic, safeExternalUrl } from "@/lib/news/queries";
import { getCurrentProfile } from "@/lib/profile/queries";

export async function generateMetadata(props: PageProps<"/news/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const item = z.uuid().safeParse(id).success ? await getNewsItem(id) : null;
  return item ? { title: item.title } : {};
}

// Hír-részlet (§18.5): kép · cím · forrás + pontos dátum + életkor · FreshnessBadge · kivonat · eredeti cikk · akciós figyelmeztetés ·
// „Hibásnak tűnik?" · hasonló hírek · jogi megjegyzés. Csak a címet és a rövid kivonatot mutatjuk (H7, §18.3/10).
export default async function NewsDetailPage(props: PageProps<"/news/[id]">) {
  const t = await getTranslations("news");
  const tt = await getTranslations("news.topics");
  const locale = (await getLocale()) as Locale;
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();
  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/news/${id}`)}`);

  const item = await getNewsItem(id);
  if (!item) notFound();

  const now = new Date();
  const topicKey = (["deals", "prices", "utilities", "banking", "saving"] as const).find((x) => x === resolveTopic(item.topic));
  const [similarFeed] = await Promise.all([getNewsFeed(topicKey, undefined, 4)]);
  const similar = await buildNewsCards(similarFeed.items.filter((s) => s.id !== item.id).slice(0, 3), locale, now);
  const link = safeExternalUrl(item.url);
  const freshnessLabel = item.freshness === "fresh" ? t("fresh") : item.freshness === "stale" ? t("stale") : null;

  return (
    <article className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href="/news" className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text">
        <ChevronLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <NewsImage src={item.imageUrl} topic={item.topic} className="aspect-video w-full rounded-card" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl leading-snug font-semibold">{item.title}</h1>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-2">
          <span className="font-medium">{t("source", { name: item.sourceName })}</span>
          <span aria-hidden>·</span>
          <time dateTime={item.publishedAt}>{formatDate(item.publishedAt, locale, profile.timezone)}</time>
          <span>({formatAge(item.publishedAt, now, locale)})</span>
          <FreshnessBadge freshness={item.freshness} label={freshnessLabel} />
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">{tt((topicKey ?? "general") as "general")}</span>
        </p>
      </div>
      {item.snippet && <p className="text-base">{item.snippet}</p>}

      {item.topic === "deals" && (
        <p role="note" className="flex items-start gap-2 rounded-card border border-border bg-warning/15 p-4 text-sm text-warning-text">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t("dealDisclaimer")}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {link && (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center gap-2 rounded-control bg-primary px-5 font-medium text-primary-fg"
          >
            {t("openOriginal")}
            <ExternalLink className="size-4" aria-hidden />
          </a>
        )}
        <ReportButton newsId={item.id} />
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-title" className="flex flex-col gap-3">
          <h2 id="similar-title" className="text-lg font-semibold">
            {t("similar")}
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {similar.map((c) => (
              <li key={c.id} className="flex min-w-0 flex-col">
                <NewsCard card={c} />
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-sm text-text-2">{t("legalItem", { name: item.sourceName })}</p>
    </article>
  );
}

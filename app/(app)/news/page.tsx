import type { Metadata } from "next";
import { Newspaper } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { NewsList } from "@/components/news/news-list";
import { NewsToggle } from "@/components/news/news-toggle";
import { EmptyState } from "@/components/ui/empty-state";
import type { Locale } from "@/lib/i18n/config";
import { buildNewsCards } from "@/lib/news/cards";
import { NEWS_PAGE_SIZE, NEWS_TOPICS, getNewsEnabled, getNewsFeed, resolveTopic } from "@/lib/news/queries";
import { getCurrentProfile } from "@/lib/profile/queries";
import { first } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("news");
  return { title: t("title") };
}

const CHIP = "flex min-h-11 items-center rounded-full border px-4 text-sm font-medium";
const LINK_BTN = "inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";

export default async function NewsPage(props: PageProps<"/news">) {
  const t = await getTranslations("news");
  const tt = await getTranslations("news.topics");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fnews");

  const topic = resolveTopic(first((await props.searchParams).topic));
  const enabled = await getNewsEnabled(profile.id);

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold">{t("title")}</h1>
      <NewsToggle enabled={enabled} className={LINK_BTN} />
    </div>
  );

  if (!enabled) {
    return (
      <div className="flex flex-col gap-5">
        {header}
        <EmptyState icon={Newspaper} title={t("disabled.title")} body={t("disabled.body")} />
      </div>
    );
  }

  const { items, failed } = await getNewsFeed(topic);
  const cards = await buildNewsCards(items, locale);
  const last = items[items.length - 1];

  return (
    <div className="flex flex-col gap-5">
      {header}
      <div role="region" aria-label={t("topicsLabel")} tabIndex={0} className="-mx-1 overflow-x-auto px-1">
        <ul className="flex w-max gap-2">
          <li>
            <Link href="/news" aria-current={topic ? undefined : "true"} className={cn(CHIP, topic ? "border-border bg-surface text-text-2 hover:bg-surface-2" : "border-primary bg-primary-soft text-primary-text")}>
              {t("topics.all")}
            </Link>
          </li>
          {NEWS_TOPICS.map((tp) => (
            <li key={tp}>
              <Link
                href={`/news?topic=${tp}`}
                aria-current={topic === tp ? "true" : undefined}
                className={cn(CHIP, topic === tp ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-surface text-text-2 hover:bg-surface-2")}
              >
                {tt(tp)}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {failed ? (
        <p role="alert" className="py-8 text-center text-danger-text">
          {t("unavailable")}
        </p>
      ) : cards.length === 0 ? (
        <EmptyState icon={Newspaper} title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <NewsList
          key={topic ?? "all"}
          initial={cards}
          cursor={last ? { publishedAt: last.publishedAt, id: last.id } : null}
          hasMore={items.length >= NEWS_PAGE_SIZE}
          topic={topic}
        />
      )}
      <p className="text-sm text-text-2">{t("legalList")}</p>
    </div>
  );
}

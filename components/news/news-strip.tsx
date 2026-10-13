import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/lib/i18n/config";
import { buildNewsCards } from "@/lib/news/cards";
import { getNewsFeed } from "@/lib/news/queries";
import { NewsCard } from "./news-card";

// Főoldal: 3 kártyás vízszintes sáv (§18.5); hiba vagy nincs hír esetén nem jelenik meg (a Főoldal többi része működik)
export async function NewsStrip() {
  const t = await getTranslations("news");
  const locale = (await getLocale()) as Locale;
  const { items, failed } = await getNewsFeed(undefined, undefined, 3);
  if (failed || items.length === 0) return null;
  const cards = await buildNewsCards(items, locale);

  return (
    <section aria-labelledby="news-strip-title" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 id="news-strip-title" className="text-lg font-semibold">
          {t("title")}
        </h2>
        <Link href="/news" className="flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary-text">
          {t("all")}
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div role="region" aria-label={t("stripLabel")} tabIndex={0} className="-mx-1 overflow-x-auto px-1 pb-2">
        <ul className="flex w-max gap-4">
          {cards.map((c) => (
            <li key={c.id} className="flex w-72 shrink-0 flex-col">
              <NewsCard card={c} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

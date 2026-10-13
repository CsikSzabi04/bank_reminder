"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import type { NewsCardData } from "@/lib/news/cards";
import { loadMoreNews } from "@/lib/news/actions";
import { NewsCard } from "./news-card";

type Cursor = { publishedAt: string; id: string };

// Kártya-rács (mobil 1 · tablet 2 · asztal 3 oszlop) + „Továbbiak" kurzoros lapozással (12 tétel/lap)
export function NewsList({ initial, cursor, hasMore, topic }: { initial: NewsCardData[]; cursor: Cursor | null; hasMore: boolean; topic?: string }) {
  const t = useTranslations("news");
  const locale = useLocale();
  const [cards, setCards] = useState(initial);
  const [next, setNext] = useState(cursor);
  const [more, setMore] = useState(hasMore);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const load = () =>
    next &&
    startTransition(async () => {
      setFailed(false);
      const res = await loadMoreNews(topic, next, locale);
      if (!res.ok) return setFailed(true);
      setCards((cur) => [...cur, ...res.cards.filter((c) => !cur.some((x) => x.id === c.id))]);
      setNext(res.next);
      setMore(res.hasMore);
    });

  return (
    <div className="flex flex-col gap-5">
      <ul aria-label={t("title")} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.id} className="flex min-w-0 flex-col">
            <NewsCard card={c} />
          </li>
        ))}
      </ul>
      {failed && (
        <p role="alert" className="text-center text-danger-text">
          {t("loadMoreFailed")}
        </p>
      )}
      {more && (
        <div className="flex justify-center">
          <button
            type="button"
            disabled={pending}
            onClick={load}
            className="min-h-12 rounded-control border border-border bg-surface px-6 font-medium hover:bg-surface-2 disabled:opacity-60"
          >
            {pending ? t("loading") : t("loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}

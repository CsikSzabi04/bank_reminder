import Link from "next/link";
import type { NewsCardData } from "@/lib/news/cards";
import { FreshnessBadge } from "./freshness-badge";
import { NewsImage } from "./news-image";

// Hír-kártya (§18.5): kép (16:9, lusta, referrer nélkül; hiba esetén téma-ikonos tartalék) · cím (2 sor) · kivonat (2 sor) ·
// meta: forrás · életkor · FreshnessBadge · téma. A teljes kártya a részletoldalra visz; az életkort a szerver írta ki.
export function NewsCard({ card }: { card: NewsCardData }) {
  return (
    <article className="relative flex min-w-0 flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <NewsImage src={card.imageUrl} topic={card.topic} className="aspect-video w-full" />
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-base leading-snug font-semibold">
          <Link href={`/news/${card.id}`} className="after:absolute after:inset-0 hover:underline">
            {card.title}
          </Link>
        </h3>
        {card.snippet && <p className="line-clamp-2 text-sm text-text-2">{card.snippet}</p>}
        <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1 text-sm text-text-2">
          <span className="font-medium">{card.source}</span>
          <span aria-hidden>·</span>
          <span>{card.age}</span>
          <FreshnessBadge freshness={card.freshness} label={card.freshnessLabel} />
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium">{card.topicLabel}</span>
        </p>
      </div>
    </article>
  );
}

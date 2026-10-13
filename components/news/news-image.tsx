"use client";

import { Landmark, Newspaper, PiggyBank, ShoppingBasket, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { safeImageUrl } from "@/lib/news/image";

const TOPIC_ICONS: Record<string, LucideIcon> = {
  deals: ShoppingBasket,
  prices: ShoppingBasket,
  utilities: Zap,
  banking: Landmark,
  saving: PiggyBank,
};

// A kiadó képe közvetlenül (hotlink, nem terheljük a Vercel image-kvótát, nem másoljuk — §18.6), `referrerPolicy="no-referrer"`.
// Hiány vagy betöltési hiba esetén színátmenetes, téma-ikonos tartalék.
export function NewsImage({ src, topic, className = "" }: { src: string | null; topic: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  const url = safeImageUrl(src);
  const Icon = TOPIC_ICONS[topic] ?? Newspaper;

  if (!url || failed) {
    return (
      <div aria-hidden className={`flex items-center justify-center bg-gradient-to-br from-primary-soft to-surface-2 text-primary-text ${className}`}>
        <Icon className="size-10 opacity-70" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- szándékos hotlink (§18.6): nincs optimalizáló, a kiadó CDN-jéről töltődik
    <img src={url} alt="" loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} className={`bg-surface-2 object-cover ${className}`} />
  );
}

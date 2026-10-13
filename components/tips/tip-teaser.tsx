import { ChevronRight, Lightbulb } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { buildTipCards } from "@/lib/tips/cards";
import type { Locale } from "@/lib/i18n/config";
import type { TipView } from "@/lib/tips/queries";

// A Főoldal egyetlen tippje (§17.6): a legnagyobb becsült megtakarítású; a teljes lista a /tips-en
export async function TipTeaser({ tip, currency }: { tip: TipView; currency: string }) {
  const t = await getTranslations("tips");
  const locale = (await getLocale()) as Locale;
  const [card] = await buildTipCards([tip], locale, currency);
  if (!card) return null;

  return (
    <section aria-labelledby="tip-teaser-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 id="tip-teaser-title" className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Lightbulb className="size-5 text-primary-text" aria-hidden />
        {t("teaserTitle")}
      </h2>
      <p className="font-medium">{card.title}</p>
      <p className="mt-0.5 text-sm text-text-2">{card.body}</p>
      {card.estimate && <p className="mt-1 text-sm font-medium text-success-text">{card.estimate}</p>}
      <Link href="/tips" className="mt-2 flex min-h-11 w-fit items-center gap-0.5 text-sm font-medium text-primary-text">
        {t("allTips")}
        <ChevronRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}

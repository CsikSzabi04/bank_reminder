import "server-only";
import { getTranslations } from "next-intl/server";
import type { TipCardProps } from "@/components/tips/tip-card";
import { getCategoryOptions } from "@/lib/budgets/queries";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { USAGE_TAGS } from "@/lib/schemas/reminder";
import { isTipCode, tipVars } from "./describe";
import { getUsageTags, type TipView } from "./queries";

const GROUPS = ["video_streaming", "music_streaming", "cloud_storage", "game_subscription"] as const;

// A tippek kártya-adatai: a szöveg a `locales`-ból (tips.<kód>.title|body|why), a paraméterek formázva. Ismeretlen kódot nem mutatunk.
export async function buildTipCards(tips: TipView[], locale: Locale, currency: string): Promise<TipCardProps[]> {
  const t = await getTranslations("tips");
  const tg = await getTranslations("tips.groups");
  const tu = await getTranslations("reminders.form.usageTag");
  const categories = new Map((await getCategoryOptions(locale)).map((c) => [c.id, c.name]));
  const known = tips.filter((x) => isTipCode(x.code));
  const usage = await getUsageTags(known.filter((x) => x.code === "sub_maybe_redundant").flatMap((x) => x.reminderIds.slice(0, 1)));

  const ctx = {
    locale,
    currency,
    categoryName: (id: string) => categories.get(id) ?? t("categoryFallback"),
    usageLabel: (tag: string) => ((USAGE_TAGS as readonly string[]).includes(tag) ? tu(tag as (typeof USAGE_TAGS)[number]) : tag),
    groupLabel: (g: string) => ((GROUPS as readonly string[]).includes(g) ? tg(g as (typeof GROUPS)[number]) : tg("other")),
  };

  return known.flatMap((tip) => {
    if (!isTipCode(tip.code)) return [];
    const vars = tipVars(tip.code, tip.params, ctx);
    const reminderId = tip.reminderIds[0];
    return [
      {
        id: tip.id,
        code: tip.code,
        severity: tip.severity,
        status: tip.status,
        reminderId,
        title: t(`${tip.code}.title`, vars),
        body: t(`${tip.code}.body`, vars),
        why: t(`${tip.code}.why`, vars),
        estimate: tip.est !== null && tip.est > 0 ? t("estimate", { amount: formatMoney(tip.est, currency, locale) }) : undefined,
        usage:
          tip.code === "sub_maybe_redundant" && reminderId
            ? { selected: usage.get(reminderId) ?? [], options: USAGE_TAGS.map((tag) => ({ tag, label: tu(tag) })) }
            : undefined,
      } satisfies TipCardProps,
    ];
  });
}

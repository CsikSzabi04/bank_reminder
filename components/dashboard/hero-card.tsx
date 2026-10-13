import { TrendingDown, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { categoryColorVar } from "@/lib/category-icons";
import { formatMoney, formatMonth, formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { DashboardSummary } from "@/types/rpc";

// A „Havi kiadás" hero kártya (ref-1): nagy szám + változás + fánk kategória-csoportonként.
// Az összegeket és a változást az SQL adja; itt csak formázunk, a fánk arányai a geometriához kellenek (H9).
export async function HeroCard({ summary, locale }: { summary: DashboardSummary; locale: Locale }) {
  const t = await getTranslations("dashboard");
  const tg = await getTranslations("analytics.groups");
  const { hero, base_currency: currency } = summary;
  const total = summary.groups.reduce((sum, g) => sum + g.total, 0);

  const slices: DonutSlice[] = summary.groups
    .filter((g) => g.total > 0)
    .map((g) => ({
      key: g.group_key,
      label: tg(g.group_key),
      value: g.total,
      color: categoryColorVar(g.group_slot),
      valueText: formatMoney(g.total, currency, locale),
      shareText: formatPercent(total > 0 ? g.total / total : 0, locale),
    }));

  const delta = hero.delta_pct;
  const pct = formatPercent(Math.abs(delta ?? 0) / 100, locale);
  // a "kiadás nő" figyelmeztető (nem zöld); a csökkenés a jó irány — ikon + szöveg + előjel, nem csak szín (§15.4)
  const deltaView =
    delta === null
      ? { text: t("deltaNone"), icon: null, cls: "text-text-2" }
      : delta > 0
        ? { text: t("deltaUp", { pct }), icon: TrendingUp, cls: "text-warning-text" }
        : delta < 0
          ? { text: t("deltaDown", { pct }), icon: TrendingDown, cls: "text-success-text" }
          : { text: t("deltaFlat"), icon: null, cls: "text-text-2" };
  const DeltaIcon = deltaView.icon;

  const summaryText = slices.map((s) => `${s.label} ${s.valueText} (${s.shareText})`).join(", ");

  return (
    <section aria-labelledby="hero-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 id="hero-title" className="text-sm font-medium text-text-2">
        {t("monthTotal")}
      </h2>
      <p className="mt-1 text-[40px] leading-[1.1] font-semibold whitespace-nowrap">{formatMoney(hero.total, currency, locale)}</p>
      <p className={`mt-2 flex items-center gap-1.5 text-sm ${deltaView.cls}`}>
        {DeltaIcon && <DeltaIcon className="size-4" aria-hidden />}
        {deltaView.text}
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-text-2">{t("paid")}</dt>
          <dd className="font-medium tabular-nums">{formatMoney(hero.paid, currency, locale)}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="text-text-2">{t("remaining")}</dt>
          <dd className="font-medium tabular-nums">{formatMoney(hero.remaining, currency, locale)}</dd>
        </div>
      </dl>
      {hero.unconverted > 0 && <p className="mt-2 text-sm text-warning-text">{t("unconverted", { count: hero.unconverted })}</p>}

      {slices.length > 0 && (
        <div className="mt-6">
          <DonutChart slices={slices} ariaLabel={t("chartLabel", { summary: summaryText })}>
            <span className="text-xs text-text-2">{formatMonth(summary.month, locale)}</span>
          </DonutChart>
        </div>
      )}
    </section>
  );
}

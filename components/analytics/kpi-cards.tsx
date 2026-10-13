import { TrendingDown, TrendingUp } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Sparkline } from "@/components/charts/sparkline";
import { formatMoney, formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

export type Kpi = {
  key: "spend" | "paid" | "remaining" | "subs";
  value: number;
  /** a havi egyenérték az „Előfizetések (évesítve)" kártyán */
  hint?: string;
  /** változás az előző hónaphoz (százalék); csak a havi kiadásnál */
  deltaPct?: number | null;
  spark: number[];
};

// KPI-sor (K1–K4): nagy szám + sparkline; a változás ikon + előjel + szöveg (nem csak szín), a „kiadás nő" figyelmeztető, nem zöld
export async function KpiCards({ items, currency, locale }: { items: Kpi[]; currency: string; locale: Locale }) {
  const t = await getTranslations("analytics.kpi");
  const td = await getTranslations("dashboard");

  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => {
        const delta = k.deltaPct;
        const pct = formatPercent(Math.abs(delta ?? 0) / 100, locale);
        const view =
          delta === undefined
            ? null
            : delta === null
              ? { text: td("deltaNone"), Icon: null, cls: "text-text-2" }
              : delta > 0
                ? { text: td("deltaUp", { pct }), Icon: TrendingUp, cls: "text-warning-text" }
                : delta < 0
                  ? { text: td("deltaDown", { pct }), Icon: TrendingDown, cls: "text-success-text" }
                  : { text: td("deltaFlat"), Icon: null, cls: "text-text-2" };
        return (
          <li key={k.key} className="flex min-w-0 flex-col gap-1 rounded-card border border-border bg-surface p-4 shadow-card">
            <span className="text-sm text-text-2">{t(k.key)}</span>
            <span className="text-xl leading-tight font-semibold tabular-nums">{formatMoney(k.value, currency, locale)}</span>
            {k.hint && <span className="text-sm text-text-2">{k.hint}</span>}
            {view && (
              <span className={`flex items-center gap-1 text-sm ${view.cls}`}>
                {view.Icon && <view.Icon className="size-4" aria-hidden />}
                {view.text}
              </span>
            )}
            <div className="mt-1">
              <Sparkline values={k.spark} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

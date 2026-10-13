import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ChartTable } from "@/components/charts/chart-table";
import type { SubscriptionRow } from "@/lib/analytics/queries";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

// C7: az előfizetések költsége — fent a nagy szám („évente …": a csendes pénzfaló feltárása), lent név · havi · éves · részesedés.
// A havi egyenértéket és az éves összeget az SQL számolta; a részesedés-sáv csak geometria.
export async function SubscriptionCosts({
  rows,
  yearlyTotal,
  currency,
  locale,
  table,
}: {
  rows: SubscriptionRow[];
  yearlyTotal: number;
  currency: string;
  locale: Locale;
  table: boolean;
}) {
  const t = await getTranslations("analytics");
  const money = (n: number) => formatMoney(n, currency, locale);
  if (rows.length === 0) return <p className="py-6 text-center text-text-2">{t("c7.none")}</p>;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-2xl font-semibold tabular-nums">{t("c7.perYear", { amount: money(yearlyTotal) })}</p>
      {table ? (
        <ChartTable
          caption={t("c7.title")}
          columns={[t("table.item"), t("table.monthly"), t("table.yearly"), t("table.share")]}
          rows={rows.map((r) => ({ label: r.name, cells: [money(r.monthly), money(r.yearly), `${Math.round(r.share_pct)}%`] }))}
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((r) => (
            <li key={r.reminder_id} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <Link href={`/reminders/${r.reminder_id}`} className="min-w-0 truncate font-medium hover:underline">
                  {r.name}
                </Link>
                <span className="tabular-nums text-text-2">
                  {t("c7.row", { monthly: money(r.monthly), yearly: money(r.yearly), share: `${Math.round(r.share_pct)}%` })}
                </span>
              </div>
              <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(2, Math.min(100, Math.round(r.share_pct)))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

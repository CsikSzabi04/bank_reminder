import { getTranslations } from "next-intl/server";
import { ChartTable } from "@/components/charts/chart-table";
import { CumulativeLine } from "@/components/charts/cumulative-line";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { StackedBars, type StackSeries } from "@/components/charts/stacked-bars";
import { TopBars } from "@/components/charts/top-bars";
import { UpcomingHeat, type HeatDay } from "@/components/charts/upcoming-heat";
import { categoryColorVar } from "@/lib/category-icons";
import { denseDays } from "@/lib/charts/axes";
import { formatCompactNumber, formatDate, formatMoney, formatMonth, formatMonthShort, formatPercent } from "@/lib/format";
import type { AnalyticsData } from "@/lib/analytics/queries";
import { groupKeyForSlot } from "@/lib/analytics/groups";
import type { Range } from "@/lib/analytics/range";
import type { AnalyticsView } from "@/lib/analytics/url";
import type { Locale } from "@/lib/i18n/config";
import type { GroupKey } from "@/types/rpc";
import { ChartCard } from "./chart-card";
import { SubscriptionCosts } from "./subscription-costs";

type Props = {
  data: AnalyticsData;
  month: string;
  range: Range;
  view: AnalyticsView;
  locale: Locale;
  currency: string;
};

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const heatLevel = (v: number, max: number): HeatDay["level"] => {
  if (v <= 0 || max <= 0) return 0;
  const r = v / max;
  return r > 0.75 ? 4 : r > 0.5 ? 3 : r > 0.25 ? 2 : 1;
};

// A C1–C7 diagramok (§15.4). Az összegeket az SQL adja (H9); itt formázunk és rajzolunk. A „Táblázat" nézetben ugyanaz az adat <table>-ben.
export async function AnalyticsCharts({ data, month, range, view, locale, currency }: Props) {
  const t = await getTranslations("analytics");
  const tg = await getTranslations("analytics.groups");
  const money = (n: number) => formatMoney(n, currency, locale);
  const axis = (n: number) => formatCompactNumber(n, locale);
  const table = view === "table";

  // ── C1 kategória-fánk
  const groups = data.byGroup.filter((g) => g.total > 0);
  const groupsTotal = sum(groups.map((g) => g.total));
  const slices: DonutSlice[] = groups.map((g) => ({
    key: g.group_key,
    label: tg(g.group_key as GroupKey),
    value: g.total,
    color: categoryColorVar(g.group_slot),
    valueText: money(g.total),
    shareText: formatPercent(groupsTotal > 0 ? g.total / groupsTotal : 0, locale),
  }));
  const c1Center = range === "month" ? formatMonth(month, locale) : t(`ranges.${range}`);

  // ── C2 havi trend
  const months = data.trend.map((r) => r.month);
  const monthLabels = months.map((m) => formatMonthShort(m, locale));
  const trendTotals = data.trend.map((r) => r.paid + r.remaining);
  const nonEmpty = trendTotals.filter((v) => v > 0);
  const average = nonEmpty.length ? sum(nonEmpty) / nonEmpty.length : 0;
  const trendSeries: StackSeries[] = [
    { key: "paid", label: t("series.paid"), color: "var(--primary)", values: data.trend.map((r) => r.paid) },
    { key: "remaining", label: t("series.remaining"), color: "var(--primary)", hatched: true, values: data.trend.map((r) => r.remaining) },
  ];
  const highlight = months.indexOf(month);

  // ── C3 a hónap lefutása
  const cur = data.cumulative.map((r) => r.cum_this);
  const prev = data.cumulative.map((r) => r.cum_prev);

  // ── C4 top 5
  const topMax = Math.max(0, ...data.top.map((r) => r.total));

  // ── C5 kategóriák alakulása: slotonként egy sorozat, a hónapok a trend hónapjai
  const slots = [...new Set(data.groupTrend.map((r) => r.group_slot))].sort((a, b) => a - b);
  const groupSeries: StackSeries[] = slots.map((slot) => ({
    key: `g${slot}`,
    label: tg(groupKeyForSlot(slot)),
    color: categoryColorVar(slot),
    values: months.map((m) => data.groupTrend.find((r) => r.month === m && r.group_slot === slot)?.total ?? 0),
  }));

  // ── C6 következő 30 nap
  const dayTotals = data.upcoming.map((d) => d.total);
  const dayMax = Math.max(0, ...dayTotals);
  const dense = denseDays(dayTotals);
  const heat: HeatDay[] = data.upcoming.map((d, i) => {
    const dateText = formatDate(d.day, locale, "UTC");
    const items = t("items", { count: d.items });
    const isDense = dense.has(i);
    return {
      date: d.day,
      dayText: String(Number(d.day.slice(8, 10))),
      monthText: i === 0 || d.day.endsWith("-01") ? formatMonthShort(d.day, locale) : undefined,
      dateText,
      items: d.items,
      amountText: d.items > 0 ? formatCompactNumber(d.total, locale) : "",
      level: heatLevel(d.total, dayMax),
      dense: isDense,
      href: `/calendar?month=${d.day.slice(0, 7)}&day=${d.day}`,
      label: `${dateText}, ${items}, ${money(d.total)}${isDense ? `, ${t("denseDay")}` : ""}`,
    };
  });

  const noData = <p className="py-6 text-center text-text-2">{t("noData")}</p>;
  const monthsSummary = (xs: number[]) => months.map((m, i) => `${formatMonth(m, locale)} ${money(xs[i])}`).join(", ");

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard id="c1" title={t("c1.title")}>
        {slices.length === 0 ? (
          noData
        ) : table ? (
          <ChartTable
            caption={t("c1.title")}
            columns={[t("table.category"), t("table.amount"), t("table.share"), t("table.items")]}
            rows={groups.map((g) => ({
              label: tg(g.group_key as GroupKey),
              cells: [money(g.total), formatPercent(groupsTotal > 0 ? g.total / groupsTotal : 0, locale), String(g.items)],
            }))}
          />
        ) : (
          <DonutChart slices={slices} ariaLabel={t("c1.aria", { summary: slices.map((s) => `${s.label} ${s.valueText} (${s.shareText})`).join(", ") })}>
            <span className="text-base font-semibold tabular-nums">{money(groupsTotal)}</span>
            <span className="text-xs text-text-2">{c1Center}</span>
          </DonutChart>
        )}
      </ChartCard>

      <ChartCard id="c2" title={t("c2.title")}>
        {trendTotals.every((v) => v === 0) ? (
          noData
        ) : table ? (
          <ChartTable
            caption={t("c2.title")}
            columns={[t("table.month"), t("series.paid"), t("series.remaining"), t("table.total")]}
            rows={data.trend.map((r) => ({ label: formatMonth(r.month, locale), cells: [money(r.paid), money(r.remaining), money(r.paid + r.remaining)] }))}
          />
        ) : (
          <StackedBars
            categories={monthLabels}
            series={trendSeries}
            average={{ value: average, label: t("series.average") }}
            highlight={highlight}
            ariaLabel={t("c2.aria", { summary: monthsSummary(trendTotals) })}
            formatAxis={axis}
            formatValue={money}
          />
        )}
      </ChartCard>

      <ChartCard id="c3" title={t("c3.title")} hint={formatMonth(month, locale)}>
        {cur.length === 0 || cur[cur.length - 1] === 0 ? (
          noData
        ) : table ? (
          <ChartTable
            caption={t("c3.title")}
            columns={[t("table.day"), t("series.thisMonth"), t("series.prevMonth")]}
            rows={data.cumulative
              .filter((_, i, a) => i === 0 || (i + 1) % 5 === 0 || i === a.length - 1)
              .map((r) => ({ label: formatDate(r.day, locale, "UTC"), cells: [money(r.cum_this), r.cum_prev === null ? "—" : money(r.cum_prev)] }))}
          />
        ) : (
          <CumulativeLine
            days={cur.length}
            current={cur}
            previous={prev}
            currentLabel={t("series.thisMonth")}
            previousLabel={t("series.prevMonth")}
            ariaLabel={t("c3.aria", { month: formatMonth(month, locale), total: money(cur[cur.length - 1]) })}
            formatAxis={axis}
          />
        )}
      </ChartCard>

      <ChartCard id="c4" title={t("c4.title")}>
        {data.top.length === 0 ? (
          noData
        ) : table ? (
          <ChartTable
            caption={t("c4.title")}
            columns={[t("table.item"), t("table.category"), t("table.amount")]}
            rows={data.top.map((r) => ({ label: r.name, cells: [tg(groupKeyForSlot(r.group_slot)), money(r.total)] }))}
          />
        ) : (
          <TopBars
            ariaLabel={t("c4.title")}
            items={data.top.map((r) => ({
              key: r.reminder_id,
              label: r.name,
              valueText: money(r.total),
              fraction: topMax > 0 ? r.total / topMax : 0,
              color: categoryColorVar(r.group_slot),
            }))}
          />
        )}
      </ChartCard>

      <ChartCard id="c5" title={t("c5.title")} className="lg:col-span-2">
        {groupSeries.length === 0 ? (
          noData
        ) : table ? (
          <ChartTable
            caption={t("c5.title")}
            columns={[t("table.month"), ...groupSeries.map((s) => s.label)]}
            rows={months.map((m, i) => ({ label: formatMonth(m, locale), cells: groupSeries.map((s) => money(s.values[i])) }))}
          />
        ) : (
          <StackedBars
            categories={monthLabels}
            series={groupSeries}
            highlight={highlight}
            ariaLabel={t("c5.aria", { summary: monthsSummary(months.map((_, i) => sum(groupSeries.map((s) => s.values[i])))) })}
            formatAxis={axis}
            formatValue={money}
          />
        )}
      </ChartCard>

      <ChartCard id="c6" title={t("c6.title")} hint={t("c6.hint")} className="lg:col-span-2">
        {dayMax === 0 ? (
          noData
        ) : table ? (
          <ChartTable
            caption={t("c6.title")}
            columns={[t("table.day"), t("table.items"), t("table.amount")]}
            rows={data.upcoming.filter((d) => d.items > 0).map((d) => ({ label: formatDate(d.day, locale, "UTC"), cells: [String(d.items), money(d.total)] }))}
          />
        ) : (
          <>
            <UpcomingHeat days={heat} ariaLabel={t("c6.title")} />
            {dense.size > 0 && <p className="text-sm text-text-2">{t("c6.denseNote")}</p>}
          </>
        )}
      </ChartCard>

      <ChartCard id="c7" title={t("c7.title")} className="lg:col-span-2">
        <SubscriptionCosts rows={data.subscriptions} yearlyTotal={data.summary?.subscriptions.yearly_total ?? 0} currency={currency} locale={locale} table={table} />
      </ChartCard>
    </div>
  );
}

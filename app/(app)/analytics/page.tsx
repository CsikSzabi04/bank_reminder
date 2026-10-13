import type { Metadata } from "next";
import { Lightbulb, LineChart } from "lucide-react";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { RangeChips, ViewToggle } from "@/components/analytics/controls";
import { KpiCards, type Kpi } from "@/components/analytics/kpi-cards";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { LoadDemoButton } from "@/components/reminders/demo-buttons";
import { EmptyState } from "@/components/ui/empty-state";
import { buildInsights } from "@/lib/analytics/insights";
import { getAnalytics } from "@/lib/analytics/queries";
import { resolveRange, trendMonths } from "@/lib/analytics/range";
import { resolveMonth } from "@/lib/dashboard";
import { formatMoney, formatPercent, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("analytics");
  return { title: t("title") };
}

export default async function AnalyticsPage(props: PageProps<"/analytics">) {
  const t = await getTranslations("analytics");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fanalytics");

  const params = await props.searchParams;
  const today = todayIn(profile.timezone);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const month = resolveMonth(first(params.month), today);
  const range = resolveRange(first(params.range));
  const view = first(params.view) === "table" ? "table" : "chart";
  const data = await getAnalytics(month, range, trendMonths(range, currentMonth));

  const summary = data.summary;
  const empty =
    !summary || (summary.hero.total === 0 && summary.subscriptions.count === 0 && data.trend.every((r) => r.paid + r.remaining === 0));
  const state = { month, currentMonth, range, view } as const;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <MonthSwitcher month={month} currentMonth={currentMonth} locale={locale} basePath="/analytics" />
          <ViewToggle {...state} />
        </div>
      </div>

      {empty || !summary ? (
        <EmptyState icon={LineChart} title={t("empty.title")} body={t("empty.body")}>
          <LoadDemoButton />
        </EmptyState>
      ) : (
        <>
          <RangeChips {...state} />
          <KpiCards items={kpis(data, summary)} currency={summary.base_currency} locale={locale} />
          {summary.hero.unconverted > 0 && <p className="text-sm text-warning-text">{(await getTranslations("dashboard"))("unconverted", { count: summary.hero.unconverted })}</p>}
          <Insights data={data} summary={summary} locale={locale} />
          <AnalyticsCharts data={data} month={month} range={range} view={view} locale={locale} currency={summary.base_currency} />
        </>
      )}
    </div>
  );
}

// KPI-k: a sparkline az utolsó 6 hónap (a trend az aktuális hónappal záródik)
function kpis(data: Awaited<ReturnType<typeof getAnalytics>>, summary: NonNullable<Awaited<ReturnType<typeof getAnalytics>>["summary"]>): Kpi[] {
  const last6 = data.trend.slice(-6);
  const subsByMonth = last6.map((r) => data.groupTrend.find((g) => g.month === r.month && g.group_slot === 1)?.total ?? 0);
  return [
    { key: "spend", value: summary.hero.total, deltaPct: summary.hero.delta_pct, spark: last6.map((r) => r.paid + r.remaining) },
    { key: "paid", value: summary.hero.paid, spark: last6.map((r) => r.paid) },
    { key: "remaining", value: summary.hero.remaining, spark: last6.map((r) => r.remaining) },
    { key: "subs", value: summary.subscriptions.yearly_total, spark: subsByMonth },
  ];
}

async function Insights({
  data,
  summary,
  locale,
}: {
  data: Awaited<ReturnType<typeof getAnalytics>>;
  summary: NonNullable<Awaited<ReturnType<typeof getAnalytics>>["summary"]>;
  locale: Locale;
}) {
  const t = await getTranslations("analytics");
  const top = data.top[0];
  const insights = buildInsights({
    deltaPct: summary.hero.delta_pct,
    top: top ? { name: top.name, total: top.total } : null,
    subsMonthly: summary.subscriptions.monthly_total,
    monthTotal: summary.hero.total,
    cumulative: data.cumulative.map((r) => r.cum_this),
  });
  if (insights.length === 0) return null;

  return (
    <section aria-labelledby="insights-title" className="rounded-card border border-border bg-primary-soft/50 p-5">
      <h2 id="insights-title" className="mb-2 flex items-center gap-2 text-lg font-semibold">
        <Lightbulb className="size-5 text-primary-text" aria-hidden />
        {t("insights.title")}
      </h2>
      <ul className="flex flex-col gap-1.5">
        {insights.map((i) => (
          <li key={i.code}>
            {i.code === "topItem"
              ? t("insights.topItem", { name: i.name, amount: formatMoney(i.amount, summary.base_currency, locale) })
              : t(`insights.${i.code}`, { pct: formatPercent(i.pct, locale) })}
          </li>
        ))}
      </ul>
    </section>
  );
}

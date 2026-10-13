import type { Metadata } from "next";
import { Bell, ChevronRight, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BudgetBar } from "@/components/budgets/budget-bar";
import { HeroCard } from "@/components/dashboard/hero-card";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { SubscriptionsCard } from "@/components/dashboard/subscriptions-card";
import { BillList, BillRow } from "@/components/reminders/bill-row";
import { LoadDemoButton } from "@/components/reminders/demo-buttons";
import { OccurrencePayButton } from "@/components/reminders/occurrence-pay-button";
import { EmptyState } from "@/components/ui/empty-state";
import { InstallCard } from "@/components/install/install-card";
import { NewsStrip } from "@/components/news/news-strip";
import { TipTeaser } from "@/components/tips/tip-teaser";
import { getDashboardSummary, resolveMonth } from "@/lib/dashboard";
import { todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { getCategories } from "@/lib/reminders/queries";
import { getNewsEnabled } from "@/lib/news/queries";
import { first } from "@/lib/search-params";
import { getTipsEnabled, getTopTip } from "@/lib/tips/queries";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("nav");
  return { title: t("home") };
}

const CARD = "rounded-card border border-border bg-surface p-5 shadow-card";
// a display-t a használat adja (az `hidden lg:inline-flex` ütközne egy beégetett inline-flex-szel)
const BTN = "min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-fg";

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  const t = await getTranslations("dashboard");
  const tr = await getTranslations("reminders");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fdashboard");

  const today = todayIn(profile.timezone);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const month = resolveMonth(first((await props.searchParams).month), today);

  const [summary, categories, tipsEnabled, newsEnabled] = await Promise.all([
    getDashboardSummary(month),
    getCategories(locale),
    getTipsEnabled(profile.id),
    getNewsEnabled(profile.id),
  ]);
  const topTip = tipsEnabled ? await getTopTip(today) : null;
  const name = profile.display_name || profile.email.split("@")[0];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("hello", { name })}</h1>
        <div className="flex items-center gap-2">
          <MonthSwitcher month={month} currentMonth={currentMonth} locale={locale} />
          <Link href="/reminders/new" className={`${BTN} hidden lg:inline-flex`}>
            <Plus className="size-4" aria-hidden />
            {tr("new")}
          </Link>
        </div>
      </div>

      {!summary ? (
        <p role="alert" className="text-danger-text">
          {t("noUpcoming")}
        </p>
      ) : summary.groups.length === 0 && summary.upcoming.length === 0 && summary.hero.total === 0 ? (
        <EmptyState icon={Bell} title={t("emptyTitle")} body={t("emptyBody")}>
          <Link href="/reminders/new" className={`${BTN} inline-flex`}>
            <Plus className="size-4" aria-hidden />
            {tr("new")}
          </Link>
          <LoadDemoButton />
        </EmptyState>
      ) : (
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-8">
            <HeroCard summary={summary} locale={locale} />

            <section aria-labelledby="upcoming-title" className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between">
                <h2 id="upcoming-title" className="text-lg font-semibold">
                  {t("upcoming")}
                </h2>
                <Link href="/reminders" className="flex min-h-11 items-center gap-0.5 text-sm font-medium text-primary-text">
                  {t("all")}
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
              {summary.upcoming.length === 0 ? (
                <p className="text-text-2">{t("noUpcoming")}</p>
              ) : (
                <BillList label={t("upcoming")}>
                  {summary.upcoming.map((u) => (
                    <BillRow
                      key={u.occurrence_id}
                      href={`/reminders/${u.reminder_id}`}
                      name={u.name}
                      amount={u.amount}
                      currency={u.currency}
                      dueDate={u.due_date}
                      today={today}
                      status="upcoming"
                      category={u.category_id ? categories.get(u.category_id) : null}
                      action={<OccurrencePayButton occurrenceId={u.occurrence_id} name={u.name} />}
                    />
                  ))}
                </BillList>
              )}
            </section>
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:col-span-4">
            <SubscriptionsCard summary={summary} locale={locale} />
            {topTip && <TipTeaser tip={topTip} currency={summary.base_currency} />}
            {summary.budgets.length > 0 && (
              <section aria-labelledby="budgets-title" className={CARD}>
                <h2 id="budgets-title" className="mb-4 text-lg font-semibold">
                  {t("budgets")}
                </h2>
                <div className="flex flex-col gap-4">
                  {summary.budgets.map((b) => (
                    <BudgetBar
                      key={b.category_id}
                      category={categories.get(b.category_id)}
                      spent={b.spent}
                      committed={b.committed}
                      limit={b.monthly_limit}
                      state={b.state}
                      currency={summary.base_currency}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
      {newsEnabled && summary && <NewsStrip />}
      <InstallCard />
    </div>
  );
}

import type { Metadata } from "next";
import { PiggyBank, Plus } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BudgetBar } from "@/components/budgets/budget-bar";
import { BudgetSummary } from "@/components/budgets/budget-summary";
import { CategoryIcon } from "@/components/categories/category-icon";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { QuickExpense } from "@/components/expenses/quick-expense";
import { EmptyState } from "@/components/ui/empty-state";
import { getBudgetStatus, getBudgetSuggestions, getCategoryOptions, getFrequentExpenseCategories } from "@/lib/budgets/queries";
import { resolveMonth } from "@/lib/dashboard";
import { formatMoney, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { sumMoney } from "@/lib/money";
import { getCurrentProfile } from "@/lib/profile/queries";
import { first } from "@/lib/search-params";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("budgets");
  return { title: t("title") };
}

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-fg";
const SHOWN_WITHOUT_BUDGET = 8;

export default async function BudgetsPage(props: PageProps<"/budgets">) {
  const t = await getTranslations("budgets");
  const locale = (await getLocale()) as Locale;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login?next=%2Fbudgets");

  const params = await props.searchParams;
  const today = todayIn(profile.timezone);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const month = resolveMonth(first(params.month), today);
  const monthQuery = month === currentMonth ? "" : `?month=${month.slice(0, 7)}`;

  const [rows, suggestions, options, expenseCategories] = await Promise.all([
    getBudgetStatus(month),
    getBudgetSuggestions(month),
    getCategoryOptions(locale),
    getFrequentExpenseCategories(locale, today),
  ]);
  const byId = new Map(options.map((c) => [c.id, c]));
  const currency = profile.base_currency;

  // kategóriák keret nélkül: a javasolt értékkel rendelkezők (van múltbeli költésük) elöl
  const budgeted = new Set(rows.map((r) => r.categoryId));
  const without = options
    .filter((c) => !budgeted.has(c.id))
    .sort((a, b) => Number(suggestions.has(b.id)) - Number(suggestions.has(a.id)));
  const chip = (c: (typeof without)[number]) => (
    <li key={c.id}>
      <Link
        href={`/budgets/${c.id}${monthQuery}`}
        className="flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface px-3 text-sm font-medium text-text-2 hover:bg-surface-2"
      >
        <CategoryIcon icon={c.icon} colorSlot={c.colorSlot} size={24} />
        {c.name}
        <Plus className="size-4" aria-hidden />
      </Link>
    </li>
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <QuickExpense
          categories={expenseCategories}
          today={today}
          defaultOpen={first(params.add) === "expense"}
          triggerClassName={BTN}
        />
      </div>
      <MonthSwitcher month={month} currentMonth={currentMonth} locale={locale} basePath="/budgets" />

      {rows.length === 0 ? (
        <EmptyState icon={PiggyBank} title={t("empty.title")} body={t("empty.body")} />
      ) : (
        <>
          <BudgetSummary
            limit={sumMoney(rows.map((r) => r.limit))}
            spent={sumMoney(rows.map((r) => r.spent))}
            committed={sumMoney(rows.map((r) => r.committed))}
            currency={currency}
          />
          <ul aria-label={t("title")} className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
            {rows.map((r) => {
              const c = byId.get(r.categoryId);
              return (
                <li key={r.budgetId}>
                  <Link href={`/budgets/${r.categoryId}${monthQuery}`} className="block px-4 py-3 hover:bg-surface-2">
                    <BudgetBar
                      category={c ? { id: c.id, icon: c.icon, colorSlot: c.colorSlot, name: c.name } : undefined}
                      spent={r.spent}
                      committed={r.committed}
                      limit={r.limit}
                      state={r.state}
                      currency={currency}
                    />
                    {r.forecast !== null && r.forecast > r.limit && (
                      <p className="mt-1 pl-12 text-sm text-warning-text">{t("forecast", { amount: formatMoney(r.forecast, currency, locale) })}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {without.length > 0 && (
        <section aria-labelledby="without-title" className="flex flex-col gap-2">
          <h2 id="without-title" className="text-sm font-medium text-text-2">
            {t("withoutBudget")}
          </h2>
          <ul className="flex flex-wrap gap-2">{without.slice(0, SHOWN_WITHOUT_BUDGET).map(chip)}</ul>
          {without.length > SHOWN_WITHOUT_BUDGET && (
            <details>
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-primary-text">{t("moreCategories")}</summary>
              <ul className="mt-2 flex flex-wrap gap-2">{without.slice(SHOWN_WITHOUT_BUDGET).map(chip)}</ul>
            </details>
          )}
        </section>
      )}
    </div>
  );
}

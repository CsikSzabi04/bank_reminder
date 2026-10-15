import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { BudgetBar } from "@/components/budgets/budget-bar";
import { BudgetForm } from "@/components/budgets/budget-form";
import { CategoryItems } from "@/components/budgets/category-items";
import { DeleteBudgetButton } from "@/components/budgets/delete-budget-button";
import { getBudgetStatus, getBudgetSuggestions, getCategoryItems, getCategoryOptions } from "@/lib/budgets/queries";
import { resolveMonth } from "@/lib/dashboard";
import { formatMoney, formatMonth, todayIn } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getCurrentProfile } from "@/lib/profile/queries";
import { first } from "@/lib/search-params";

export async function generateMetadata(props: PageProps<"/budgets/[category]">): Promise<Metadata> {
  const { category } = await props.params;
  const c = z.uuid().safeParse(category).success ? (await getCategoryOptions((await getLocale()) as Locale)).find((o) => o.id === category) : undefined;
  return c ? { title: c.name } : {};
}

const CARD = "flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card";

// Kategória-részlet (§16.1): a hónap tételei (számlák + gyors kiadások), a keret szerkesztése / létrehozása / törlése
export default async function BudgetCategoryPage(props: PageProps<"/budgets/[category]">) {
  const t = await getTranslations("budgets");
  const locale = (await getLocale()) as Locale;
  const { category: categoryId } = await props.params;
  if (!z.uuid().safeParse(categoryId).success) notFound();

  const profile = await getCurrentProfile();
  if (!profile) redirect(`/login?next=${encodeURIComponent(`/budgets/${categoryId}`)}`);

  const today = todayIn(profile.timezone);
  const currentMonth = `${today.slice(0, 7)}-01`;
  const month = resolveMonth(first((await props.searchParams).month), today);
  const monthQuery = month === currentMonth ? "" : `?month=${month.slice(0, 7)}`;

  const [options, rows, suggestions, items] = await Promise.all([
    getCategoryOptions(locale),
    getBudgetStatus(month),
    getBudgetSuggestions(month),
    getCategoryItems(categoryId, month),
  ]);
  const category = options.find((o) => o.id === categoryId);
  if (!category) notFound();

  const budget = rows.find((r) => r.categoryId === categoryId);
  const currency = profile.base_currency;
  const suggested = suggestions.get(categoryId) ?? budget?.suggested ?? null;
  const initialLimit = budget ? String(budget.limit) : suggested !== null ? String(suggested) : "";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <Link href={`/budgets${monthQuery}`} className="flex min-h-11 w-fit items-center gap-1 text-sm font-medium text-primary-text">
        <ChevronLeft className="size-4" aria-hidden />
        {t("back")}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">{category.name}</h1>
        <p className="text-text-2">{formatMonth(month, locale)}</p>
      </div>

      {budget && (
        <section className={CARD} aria-label={t("overall")}>
          <BudgetBar
            category={{ id: category.id, icon: category.icon, colorSlot: category.colorSlot, name: category.name }}
            spent={budget.spent}
            committed={budget.committed}
            limit={budget.limit}
            state={budget.state}
            currency={currency}
          />
          {budget.forecast !== null && <p className="text-sm text-text-2">{t("forecast", { amount: formatMoney(budget.forecast, currency, locale) })}</p>}
        </section>
      )}

      <section className={CARD} aria-labelledby="limit-title">
        <h2 id="limit-title" className="text-lg font-semibold">
          {budget ? t("editBudget") : t("newBudget")}
        </h2>
        <BudgetForm
          categoryId={categoryId}
          initialLimit={initialLimit}
          suggestionText={suggested !== null ? t("suggestion", { amount: formatMoney(suggested, currency, locale) }) : undefined}
        />
        {budget && (
          <div>
            <DeleteBudgetButton budgetId={budget.budgetId} categoryName={category.name} />
          </div>
        )}
      </section>

      <section aria-labelledby="items-title" className="flex flex-col gap-2">
        <h2 id="items-title" className="text-lg font-semibold">
          {t("items")}
        </h2>
        {items.length === 0 ? <p className="text-text-2">{t("noItems")}</p> : <CategoryItems items={items} categoryId={categoryId} />}
      </section>
    </div>
  );
}

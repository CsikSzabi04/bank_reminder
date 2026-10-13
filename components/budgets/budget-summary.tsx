import { AlertCircle } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

// Összesítő (§16.1/16.2): nagy szám „elköltve / keret", sáv, és „Mennyit költhetsz még?" (negatív → piros szöveg + ikon).
// A sorok összegét az SQL adta; az összesen-értékeket a hívó centre pontosan összegzi (lib/money.ts).
export function BudgetSummary({
  limit,
  spent,
  committed,
  currency,
}: {
  limit: number;
  spent: number;
  committed: number;
  currency: string;
}) {
  const t = useTranslations("budgets");
  const locale = useLocale() as Locale;
  const money = (n: number) => formatMoney(n, currency, locale);
  const canSpend = limit - spent - committed;
  const over = canSpend < 0;
  const spentPct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 0;
  const committedPct = limit > 0 ? Math.max(0, Math.min(100 - spentPct, (committed / limit) * 100)) : 0;

  return (
    <section aria-labelledby="budget-summary" className="rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 id="budget-summary" className="text-sm font-medium text-text-2">
        {t("canSpend")}
      </h2>
      <p className={`mt-1 flex items-center gap-2 text-[32px] leading-tight font-semibold tabular-nums ${over ? "text-danger-text" : ""}`}>
        {over && <AlertCircle className="size-7 shrink-0" aria-hidden />}
        {over ? t("overBy", { amount: money(-canSpend) }) : money(canSpend)}
      </p>
      <p className="mt-1 text-sm text-text-2 tabular-nums">{t("spentOfTotal", { spent: money(spent), limit: money(limit) })}</p>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(spentPct)}
        aria-label={t("overall")}
        className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div className={`h-full ${over ? "bg-danger" : "bg-primary"}`} style={{ width: `${spentPct}%` }} />
        {committedPct > 0 && <div className={`h-full opacity-35 ${over ? "bg-danger" : "bg-primary"}`} style={{ width: `${committedPct}%` }} />}
      </div>
      {committed > 0 && <p className="mt-2 text-sm text-text-2 tabular-nums">{t("committedNote", { amount: money(committed) })}</p>}
    </section>
  );
}

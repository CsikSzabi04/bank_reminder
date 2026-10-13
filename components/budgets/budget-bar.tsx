import { AlertCircle, CircleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CategoryIcon } from "@/components/categories/category-icon";
import type { CategoryView } from "@/lib/category-icons";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

export type BudgetState = "ok" | "watch" | "over";

const FILL: Record<BudgetState, string> = { ok: "bg-primary", watch: "bg-warning", over: "bg-danger" };

// Keret-sáv (ref-4): kitöltött rész = elköltött, halványabb szegmens = még hátralévő számlák.
// Túllépésnél a sáv teli és piros + ikon + szöveg (a szín nem az egyetlen jelzés). A százalékok csak a sáv geometriáját adják.
export function BudgetBar({
  category,
  spent,
  committed,
  limit,
  state,
  currency,
}: {
  category?: CategoryView;
  spent: number;
  committed: number;
  limit: number;
  state: BudgetState;
  currency: string;
}) {
  const t = useTranslations("budgets");
  const locale = useLocale() as Locale;
  const spentPct = limit > 0 ? Math.min(100, (spent / limit) * 100) : 100;
  const committedPct = limit > 0 ? Math.max(0, Math.min(100 - spentPct, (committed / limit) * 100)) : 0;
  const StateIcon = state === "over" ? AlertCircle : CircleAlert;

  return (
    <div className="flex items-center gap-3">
      <CategoryIcon icon={category?.icon} colorSlot={category?.colorSlot} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="truncate font-medium">{category?.name}</span>
          <span className="shrink-0 text-text-2 tabular-nums">
            {t("spentOf", { spent: formatMoney(spent, currency, locale), limit: formatMoney(limit, currency, locale) })}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(spentPct)}
          aria-label={category?.name}
          className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface-2"
        >
          <div className={cn("h-full", FILL[state])} style={{ width: `${spentPct}%` }} />
          {committedPct > 0 && <div className={cn("h-full opacity-35", FILL[state])} style={{ width: `${committedPct}%` }} />}
        </div>
        {state !== "ok" && (
          <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", state === "over" ? "text-danger-text" : "text-warning-text")}>
            <StateIcon className="size-3.5" aria-hidden />
            {t(`state.${state}`)}
          </p>
        )}
      </div>
    </div>
  );
}

import { CheckCircle2, PiggyBank } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { categoryColorVar } from "@/lib/category-icons";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { GOAL_ICONS } from "@/lib/savings/icons";
import type { GoalView } from "@/lib/savings/queries";

export function GoalIcon({ icon, colorSlot, size = 44 }: { icon: string; colorSlot: number; size?: number }) {
  const Icon = GOAL_ICONS[icon] ?? PiggyBank;
  const color = categoryColorVar(colorSlot);
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-control"
      style={{ width: size, height: size, background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
    >
      <Icon style={{ width: size * 0.5, height: size * 0.5 }} />
    </span>
  );
}

// Cél-kártya (§16.4, ref-2): ikon · név · folyamatjelző · összegyűlt / cél · határidő · „még N hónap — havi X kellene".
// A haladást, a havi szükséges összeget és az elérést az SQL-view adja; itt csak formázunk. Elérve: visszafogott „Elérted!" (nincs animáció).
export function GoalCard({ goal, href, children }: { goal: GoalView; href?: string; children?: ReactNode }) {
  const t = useTranslations("savings");
  const locale = useLocale() as Locale;
  const money = (n: number) => formatMoney(n, goal.currency, locale);
  const widthPct = Math.max(0, Math.min(100, goal.pct));
  const title = (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-base font-semibold">{goal.name}</span>
      <span className="block text-sm text-text-2 tabular-nums">{t("savedOf", { saved: money(goal.saved), target: money(goal.target) })}</span>
    </span>
  );

  return (
    <article className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 shadow-card">
      <div className="flex items-center gap-3">
        <GoalIcon icon={goal.icon} colorSlot={goal.colorSlot} />
        {href ? (
          <Link href={href} className="flex min-w-0 flex-1 hover:underline">
            {title}
          </Link>
        ) : (
          title
        )}
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatPercent(Math.floor(goal.pct) / 100, locale)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(widthPct)}
        aria-label={goal.name}
        className="h-2.5 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full" style={{ width: `${widthPct}%`, background: categoryColorVar(goal.colorSlot) }} />
      </div>
      {goal.reached ? (
        <p className="flex items-center gap-2 text-sm font-medium text-success-text">
          <CheckCircle2 className="size-4" aria-hidden />
          {t("reached")}
        </p>
      ) : (
        goal.targetDate && (
          <p className="text-sm text-text-2">
            {t("deadline", { date: formatDate(goal.targetDate, locale, "UTC") })}
            {goal.monthsLeft !== null && goal.neededPerMonth !== null && (
              <>
                {" · "}
                {t("needed", { months: goal.monthsLeft, amount: money(goal.neededPerMonth) })}
              </>
            )}
          </p>
        )
      )}
      {children}
    </article>
  );
}

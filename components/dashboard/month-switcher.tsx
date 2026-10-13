import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { MAX_MONTH_OFFSET, shiftMonth } from "@/lib/dashboard";
import { formatMonth } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

const monthsBetween = (a: string, b: string) =>
  (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + (Number(b.slice(5, 7)) - Number(a.slice(5, 7)));

const ARROW = "flex size-11 items-center justify-center rounded-full text-text-2 hover:bg-surface-2";
const ARROW_OFF = "flex size-11 items-center justify-center rounded-full text-text-muted opacity-40";

// ‹ 2026. október › — linkek (JS nélkül is működik, az állapot az URL-ben él)
export async function MonthSwitcher({ month, currentMonth, locale }: { month: string; currentMonth: string; locale: Locale }) {
  const t = await getTranslations("dashboard");
  const href = (m: string) => (m === currentMonth ? "/dashboard" : `/dashboard?month=${m.slice(0, 7)}`);
  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const canPrev = Math.abs(monthsBetween(currentMonth, prev)) <= MAX_MONTH_OFFSET;
  const canNext = Math.abs(monthsBetween(currentMonth, next)) <= MAX_MONTH_OFFSET;

  return (
    <nav aria-label={t("monthLabel")} className="flex items-center gap-1">
      {canPrev ? (
        <Link href={href(prev)} aria-label={t("prevMonth")} className={ARROW}>
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      ) : (
        <span className={ARROW_OFF}>
          <ChevronLeft className="size-5" aria-hidden />
        </span>
      )}
      <span aria-live="polite" className="min-w-36 text-center text-base font-medium">
        {formatMonth(month, locale)}
      </span>
      {canNext ? (
        <Link href={href(next)} aria-label={t("nextMonth")} className={ARROW}>
          <ChevronRight className="size-5" aria-hidden />
        </Link>
      ) : (
        <span className={ARROW_OFF}>
          <ChevronRight className="size-5" aria-hidden />
        </span>
      )}
    </nav>
  );
}

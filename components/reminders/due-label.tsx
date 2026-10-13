import { AlertCircle, CalendarClock, Check, Clock, Pause, SkipForward, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { daysUntil, dueTone, RELATIVE_LIMIT_DAYS, type DueTone } from "@/lib/due";
import { formatDate, formatRelativeDay } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const STYLE: Record<DueTone, { icon: LucideIcon; className: string }> = {
  overdue: { icon: AlertCircle, className: "text-danger-text" },
  soon: { icon: Clock, className: "text-warning-text" },
  normal: { icon: CalendarClock, className: "text-text-2" },
  paid: { icon: Check, className: "text-success-text" },
  skipped: { icon: SkipForward, className: "text-text-2" },
  paused: { icon: Pause, className: "text-text-2" },
  done: { icon: Check, className: "text-text-2" },
};

// Esedékesség-felirat: MINDIG ikon + szöveg (a szín nem hordoz egyedül jelentést, §14.1/3).
// Lejárt: "Lejárt · tegnap"; közeli: "holnap" / "3 nap múlva"; távoli: konkrét dátum.
export function DueLabel({
  status,
  dueDate,
  today,
  className,
  hideFarDate = false,
}: {
  status: string;
  dueDate: string;
  today: string;
  className?: string;
  /** a távoli dátumot nem írja ki (pl. előzmény-sorban, ahol a dátum már a sor címe) */
  hideFarDate?: boolean;
}) {
  const t = useTranslations("reminders");
  const locale = useLocale() as Locale;
  const tone = dueTone(status, dueDate, today);
  const { icon: Icon, className: toneClass } = STYLE[tone];

  const days = daysUntil(dueDate, today);
  if (hideFarDate && tone === "normal" && Math.abs(days) > RELATIVE_LIMIT_DAYS) return null;
  const when =
    Math.abs(days) <= RELATIVE_LIMIT_DAYS ? formatRelativeDay(dueDate, today, locale) : formatDate(dueDate, locale, "UTC");

  const text =
    tone === "paid"
      ? t("status.paid")
      : tone === "skipped"
        ? t("status.skipped")
        : tone === "paused"
          ? t("list.groups.paused")
          : tone === "done"
            ? t("list.groups.done")
            : tone === "overdue"
              ? `${t("overdue")} · ${when}`
              : when;

  return (
    <span className={cn("inline-flex items-center gap-1 text-sm", toneClass, className)}>
      <Icon aria-hidden className="size-3.5 shrink-0" />
      {text}
    </span>
  );
}

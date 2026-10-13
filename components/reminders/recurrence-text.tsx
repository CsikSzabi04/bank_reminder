import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/lib/i18n/config";

type Props = {
  unit: string | null;
  every: number;
  /** az első esedékesség ("YYYY-MM-DD"): ebből jön a hónap napja / a hét napja */
  startDate: string;
  monthEnd?: boolean;
};

const utc = (isoDate: string) => new Date(`${isoDate}T00:00:00Z`);

// "havonta · 10. napján", "hetente · hétfő", "évente · nov. 10.", "egyszeri" (§14.6 sor-alcím)
export function RecurrenceText({ unit, every, startDate, monthEnd = false }: Props) {
  const t = useTranslations("reminders.recurrence");
  const locale = useLocale() as Locale;
  const tag = locale === "hu" ? "hu-HU" : "en-GB";

  if (unit === "month") {
    const detail = monthEnd ? t("monthEnd") : t("monthlyOn", { day: Number(startDate.slice(8, 10)) });
    return <>{`${t("month", { n: every })} · ${detail}`}</>;
  }
  if (unit === "week") {
    const weekday = new Intl.DateTimeFormat(tag, { weekday: "long", timeZone: "UTC" }).format(utc(startDate));
    return <>{`${t("week", { n: every })} · ${weekday}`}</>;
  }
  if (unit === "year") {
    const day = new Intl.DateTimeFormat(tag, { month: "short", day: "numeric", timeZone: "UTC" }).format(utc(startDate));
    return <>{`${t("year", { n: every })} · ${day}`}</>;
  }
  if (unit === "day") return <>{t("day", { n: every })}</>;
  return <>{t("once")}</>;
}

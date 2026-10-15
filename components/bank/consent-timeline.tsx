import { Bell, Check, CircleDashed, Lock, type LucideIcon } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { consentSchedule, type ConsentStepState } from "@/lib/bank/consent";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

const STATE_ICON: Record<ConsentStepState, LucideIcon> = {
  sent: Check,
  next: Bell,
  upcoming: CircleDashed,
};

// A kötelező lejárat-értesítések ütemterve (advanced.md §8.2): a 7 lépés dátummal, a szerver lejáratából.
// Az állapot mindig ikon + szöveg (nem csak szín), a lakat jelzi, hogy nem kapcsolható ki.
export async function ConsentTimeline({
  validUntil,
  authorizedAt,
  timeZone,
  now,
}: {
  validUntil: string;
  authorizedAt: string;
  timeZone: string;
  now?: Date;
}) {
  const t = await getTranslations("bank.consent");
  const locale = (await getLocale()) as Locale;
  const steps = consentSchedule({ validUntil, authorizedAt, timeZone, now });
  if (steps.length === 0) return null;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="flex items-center gap-2 text-sm font-medium text-text">
        <Lock className="size-4 shrink-0 text-text-2" aria-hidden />
        {t("locked")}
      </p>
      <p className="text-sm text-text-2">{t("intro")}</p>
      <ol aria-label={t("listLabel")} className="flex flex-col">
        {steps.map((step) => {
          const Icon = STATE_ICON[step.state];
          return (
            <li
              key={step.daysBefore}
              aria-current={step.state === "next" ? "step" : undefined}
              className={cn(
                "flex min-h-11 items-center gap-3 border-t border-border py-2 first:border-t-0",
                step.state === "sent" && "text-text-2",
              )}
            >
              <Icon className="size-5 shrink-0" aria-hidden />
              <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-baseline sm:gap-3">
                <span className="font-medium whitespace-nowrap tabular-nums">{formatDate(step.date, locale, timeZone)}</span>
                <span className="text-sm text-text-2">{t("step", { count: step.daysBefore })}</span>
              </span>
              <span className={cn("shrink-0 text-sm", step.state === "next" ? "font-semibold text-primary-text" : "text-text-2")}>
                {t(`state.${step.state}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

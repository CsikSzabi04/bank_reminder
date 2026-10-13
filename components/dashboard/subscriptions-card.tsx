import { getTranslations } from "next-intl/server";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import type { DashboardSummary } from "@/types/rpc";

// Előfizetések: havi összeg + „évente …" (a csendes pénzfaló, §15.4/C7) + vízszintes chip-sor
export async function SubscriptionsCard({ summary, locale }: { summary: DashboardSummary; locale: Locale }) {
  const t = await getTranslations("dashboard");
  const { subscriptions: subs, base_currency: currency } = summary;
  if (subs.count === 0) return null;

  return (
    <section aria-labelledby="subs-title" className="rounded-card border border-border bg-surface p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="subs-title" className="text-lg font-semibold">
          {t("subscriptions")}
        </h2>
        <span className="text-sm text-text-2">{t("subscriptionsCount", { count: subs.count })}</span>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums">
        {t("perMonth", { amount: formatMoney(subs.monthly_total, currency, locale) })}
      </p>
      <p className="text-sm text-text-2">{t("yearly", { amount: formatMoney(subs.yearly_total, currency, locale) })}</p>
      {/* a vízszintesen görgethető sáv billentyűzettel is elérhető (tabIndex + név), különben a nyílbillentyűs görgetés nem működik */}
      <div role="region" aria-labelledby="subs-title" tabIndex={0} className="-mx-5 mt-4 overflow-x-auto px-5 pb-1">
        <ul className="flex gap-2">
          {subs.items.map((item) => (
            <li
              key={item.reminder_id}
              className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-sm"
            >
              <span className="font-medium">{item.name}</span>
              <span className="text-text-2 tabular-nums">{formatMoney(item.monthly, currency, locale)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

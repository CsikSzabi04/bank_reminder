import { CircleCheck, FileQuestion } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PendingList } from "@/components/bank/pending-list";
import { RulesManager } from "@/components/bank/rules-manager";
import { formatAge } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";
import { getRulesData, PENDING_PAGE } from "@/lib/bank/rules-queries";

const CARD = "rounded-card border border-border bg-surface p-5 shadow-card";

// Kereskedő-szabályok és „Besorolásra vár" (advanced.md §8.4): mindkét forrásra (értesítés + banki szinkron) érvényes, ezért minden felhasználónak elérhető
export async function RulesSection() {
  const t = await getTranslations("bank.rules");
  const locale = (await getLocale()) as Locale;
  const { pending, pendingTotal, rules, unparsed, categories } = await getRulesData(locale);
  const choices = categories.map((c) => ({ id: c.id, name: c.name }));
  const now = new Date();

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="pending-title" className="flex flex-col gap-3">
        <h2 id="pending-title" className="text-lg font-semibold">
          {t("pendingTitle")}
          {pendingTotal > 0 && <span className="ml-2 text-text-2">({pendingTotal})</span>}
        </h2>
        {pending.length === 0 ? (
          <p className={`${CARD} flex items-center gap-3 text-text-2`}>
            <CircleCheck className="size-5 shrink-0 text-success-text" aria-hidden />
            {t("pendingEmpty")}
          </p>
        ) : (
          <>
            <p className="text-sm text-text-2">{t("pendingLead")}</p>
            <PendingList items={pending} categories={choices} />
            {pendingTotal > PENDING_PAGE && <p className="text-sm text-text-2">{t("pendingMore", { shown: pending.length, total: pendingTotal })}</p>}
          </>
        )}
      </section>

      <RulesManager rules={rules} categories={choices} />

      {unparsed.length > 0 && (
        <section aria-labelledby="unparsed-title" className={`${CARD} flex flex-col gap-3`}>
          <h2 id="unparsed-title" className="flex items-center gap-2 text-lg font-semibold">
            <FileQuestion className="size-5 text-text-2" aria-hidden />
            {t("unparsedTitle")}
          </h2>
          <p className="text-sm text-text-2">{t("unparsedHint")}</p>
          <ul className="flex flex-col divide-y divide-border">
            {unparsed.map((event) => (
              <li key={event.id} className="flex flex-col gap-1 py-2">
                <p className="text-sm text-text-2">
                  {event.app ?? t("unknownApp")} · {formatAge(event.at, now, locale)}
                </p>
                <p className="break-words">{event.text}</p>
              </li>
            ))}
          </ul>
          <div>
            <Link href="/budgets?add=expense" className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2">
              {t("unparsedCta")}
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

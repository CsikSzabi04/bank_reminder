"use client";

import { Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { archiveGoal, deleteContribution } from "@/lib/savings/actions";
import type { ContributionView } from "@/lib/savings/queries";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

// Archiválás / visszaállítás (a cél és az előzmények megmaradnak)
export function ArchiveButton({ goalId, archived }: { goalId: string; archived: boolean }) {
  const t = useTranslations("savings");
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const Icon = archived ? ArchiveRestore : Archive;
  return (
    <button
      type="button"
      disabled={pending}
      className={BTN}
      onClick={() =>
        startTransition(async () => {
          const res = await archiveGoal(goalId, !archived);
          toast.show({ message: res.ok ? t(archived ? "restored" : "archivedToast") : t("failed"), tone: res.ok ? "success" : "error" });
          if (res.ok) router.replace(archived ? `/savings/${goalId}` : "/savings");
          if (res.ok && archived) router.refresh();
        })
      }
    >
      <Icon className="size-4" aria-hidden />
      {t(archived ? "restore" : "archive")}
    </button>
  );
}

// Előzmények: dátum · megjegyzés · ± összeg; a sor törölhető (az összegyűlt összeget az SQL-view újraszámolja)
export function ContributionList({ items, currency }: { items: ContributionView[]; currency: string }) {
  const t = useTranslations("savings");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
      {items.map((c) => (
        <li key={c.id} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <span className="block truncate font-medium">{c.note || t(c.amount > 0 ? "entryAdd" : "entryWithdraw")}</span>
            <span className="text-sm text-text-2">{formatShortDate(c.date, locale)}</span>
          </div>
          <span className={`shrink-0 font-medium tabular-nums ${c.amount < 0 ? "text-danger-text" : ""}`}>
            {c.amount > 0 ? "+" : "−"}
            {formatMoney(Math.abs(c.amount), currency, locale)}
          </span>
          <button
            type="button"
            disabled={pending}
            aria-label={t("deleteEntry", { date: formatShortDate(c.date, locale) })}
            onClick={() =>
              startTransition(async () => {
                const res = await deleteContribution(c.id);
                toast.show({ message: res.ok ? t("entryDeleted") : t("failed"), tone: res.ok ? "success" : "error" });
                if (res.ok) router.refresh();
              })
            }
            className="flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2 disabled:opacity-60"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

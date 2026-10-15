"use client";

import { Clock, Trash2, Zap } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { deleteExpense, restoreExpense } from "@/lib/budgets/actions";
import type { CategoryItem } from "@/lib/budgets/queries";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

export type ItemView = CategoryItem;

// A kategória hónapjának tételei: számla (link a részletre) vagy gyors kiadás (törölhető)
export function CategoryItems({ items, categoryId }: { items: ItemView[]; categoryId: string }) {
  const t = useTranslations("budgets");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  // törlés után a toast „Visszavonás" gombja ugyanazokkal az adatokkal újra felveszi a tételt
  const remove = (item: Extract<ItemView, { kind: "expense" }>) =>
    startTransition(async () => {
      const res = await deleteExpense(item.id);
      if (!res.ok) {
        toast.show({ message: t("expenseDeleteFailed"), tone: "error" });
        return;
      }
      toast.show({
        message: t("expenseDeleted"),
        tone: "success",
        action: {
          label: tc("undo"),
          onClick: () => {
            void restoreExpense({
              amount: item.amount,
              currency: item.currency,
              spentOn: item.date,
              categoryId,
              note: item.note,
              merchant: item.merchant,
            }).then((back) => {
              toast.show({ message: back.ok ? t("expenseRestored") : t("expenseRestoreFailed"), tone: back.ok ? "success" : "error" });
              router.refresh();
            });
          },
        },
      });
      router.refresh();
    });

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
      {items.map((i) => (
        <li key={`${i.kind}-${i.id}`} className="flex items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            {i.kind === "bill" ? (
              <Link href={`/reminders/${i.reminderId}`} className="block truncate font-medium hover:underline">
                {i.name}
              </Link>
            ) : (
              <span className="block truncate font-medium">{i.name || t("itemExpense")}</span>
            )}
            <span className="text-sm text-text-2">
              {formatShortDate(i.date, locale)} · {i.kind === "expense" ? t("itemExpense") : i.status === "paid" ? t("itemPaid") : t("itemUpcoming")}
            </span>
            {i.kind === "expense" && i.source !== "manual" && (
              <span className="ml-2 inline-flex flex-wrap items-center gap-1 align-middle">
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-text">
                  <Zap className="size-3" aria-hidden />
                  {t("badgeAuto")}
                </span>
                {i.provisional && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-text">
                    <Clock className="size-3" aria-hidden />
                    {t("badgeProvisional")}
                  </span>
                )}
              </span>
            )}
          </div>
          <span className="shrink-0 font-medium tabular-nums">{formatMoney(i.amount, i.currency, locale)}</span>
          {i.kind === "expense" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(i)}
              aria-label={t("deleteExpense", { name: i.name || t("itemExpense") })}
              className="flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2 disabled:opacity-60"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

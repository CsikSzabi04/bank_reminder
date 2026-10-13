"use client";

import { Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { deleteExpense } from "@/lib/budgets/actions";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

export type ItemView =
  | { kind: "bill"; id: string; reminderId: string; name: string; date: string; amount: number; currency: string; status: string }
  | { kind: "expense"; id: string; name: string; date: string; amount: number; currency: string };

// A kategória hónapjának tételei: számla (link a részletre) vagy gyors kiadás (törölhető)
export function CategoryItems({ items }: { items: ItemView[] }) {
  const t = useTranslations("budgets");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const remove = (id: string) =>
    startTransition(async () => {
      const res = await deleteExpense(id);
      toast.show({ message: res.ok ? t("expenseDeleted") : t("expenseDeleteFailed"), tone: res.ok ? "success" : "error" });
      if (res.ok) router.refresh();
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
          </div>
          <span className="shrink-0 font-medium tabular-nums">{formatMoney(i.amount, i.currency, locale)}</span>
          {i.kind === "expense" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => remove(i.id)}
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

"use client";

import { Clock, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { classifyBankTransaction, dismissBankTransaction } from "@/lib/bank/rules-actions";
import type { PendingTransaction } from "@/lib/bank/rules";
import type { RulesError } from "@/lib/bank/rules-service";
import { formatMoney, formatShortDate } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

export type CategoryChoice = { id: string; name: string };

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

function PendingRow({ item, categories }: { item: PendingTransaction; categories: CategoryChoice[] }) {
  const t = useTranslations("bank.rules");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const selectId = useId();
  const [categoryId, setCategoryId] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<RulesError | null>(null);
  const label = item.merchant ?? t("unknownMerchant");

  const classify = (remember: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await classifyBankTransaction({ transactionId: item.id, categoryId, remember });
      if (res.ok) {
        toast.show({ message: t("classified", { count: res.data?.classified ?? 1 }), tone: "success" });
        router.refresh();
        return;
      }
      setError(((res.reason as RulesError | undefined) ?? "failed"));
    });

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{label}</p>
          <p className="flex flex-wrap items-center gap-2 text-sm text-text-2">
            <span>{formatShortDate(item.bookedOn, locale)}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-xs font-medium text-primary-text">
              <Zap className="size-3" aria-hidden />
              {t("badgeAuto")}
            </span>
            {item.provisional && (
              <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning-text">
                <Clock className="size-3" aria-hidden />
                {t("badgeProvisional")}
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 font-semibold tabular-nums">{formatMoney(item.amount, item.currency, locale)}</span>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={selectId} className="text-sm font-medium">
          {t("categoryLabel", { name: label })}
        </label>
        <select
          id={selectId}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="min-h-11 rounded-control border border-border bg-surface px-3"
        >
          <option value="">{t("choose")}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!categoryId || pending} onClick={() => classify(false)} className={BTN}>
          {t("assign")}
        </button>
        <button type="button" disabled={!categoryId || pending || !item.merchantKey} onClick={() => classify(true)} className={BTN}>
          {t("always")}
        </button>
        <button type="button" disabled={pending} onClick={() => setConfirm(true)} className={`${BTN} text-danger-text`}>
          {t("notExpense")}
        </button>
      </div>
      <p className="text-sm text-text-2">{item.merchantKey ? t("alwaysHint") : t("noMerchant")}</p>
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {t(`error.${error}`)}
        </p>
      )}

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("notExpenseTitle")}
        description={t("notExpenseBody")}
        confirmLabel={t("notExpenseConfirm")}
        destructive
        onConfirm={async () => {
          const res = await dismissBankTransaction(item.id);
          if (!res.ok) throw new Error("dismiss_failed");
          toast.show({ message: t("dismissed"), tone: "success" });
          router.refresh();
        }}
      />
    </li>
  );
}

// A „Besorolásra vár" lista (advanced.md §8.4): besorolás · „Ezt mindig így" (szabály + a várakozó azonos kereskedősök) · „Ez nem kiadás"
export function PendingList({ items, categories }: { items: PendingTransaction[]; categories: CategoryChoice[] }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-card border border-border bg-surface shadow-card">
      {items.map((item) => (
        <PendingRow key={item.id} item={item} categories={categories} />
      ))}
    </ul>
  );
}

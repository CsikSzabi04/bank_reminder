"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import type { CategoryChoice } from "@/components/bank/pending-list";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { classifyBankTransaction, dismissBankTransaction } from "@/lib/bank/rules-actions";
import type { RulesError } from "@/lib/bank/rules-service";

const BTN =
  "inline-flex min-h-11 items-center justify-center rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

// Egy kiadásként felvett banki tétel műveletei a Tranzakciók listán: besorolás (ha még nincs kategóriája; „Ezt mindig így", ha van
// kereskedő-kulcs) és „Ez nem kiadás" (megerősítéssel) — a meglévő atomi RPC-kkel (classify/dismiss_bank_transaction).
export function TxActions({
  id,
  name,
  categorized,
  hasMerchantKey,
  categories,
}: {
  id: string;
  name: string;
  categorized: boolean;
  hasMerchantKey: boolean;
  categories: CategoryChoice[];
}) {
  const t = useTranslations("bank.rules");
  const router = useRouter();
  const toast = useToast();
  const selectId = useId();
  const [categoryId, setCategoryId] = useState("");
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<RulesError | null>(null);

  const classify = (remember: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await classifyBankTransaction({ transactionId: id, categoryId, remember });
      if (res.ok) {
        toast.show({ message: t("classified", { count: res.data?.classified ?? 1 }), tone: "success" });
        router.refresh();
        return;
      }
      setError((res.reason as RulesError | undefined) ?? "failed");
    });

  return (
    <div className="flex flex-col gap-3">
      {!categorized && (
        <>
          <div className="flex flex-col gap-1">
            <label htmlFor={selectId} className="text-sm font-medium">
              {t("categoryLabel", { name })}
            </label>
            <select id={selectId} value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="min-h-11 rounded-control border border-border bg-surface px-3">
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
            <button type="button" disabled={!categoryId || pending || !hasMerchantKey} onClick={() => classify(true)} className={BTN}>
              {t("always")}
            </button>
          </div>
        </>
      )}
      <div>
        <button type="button" disabled={pending} onClick={() => setConfirm(true)} className={`${BTN} text-danger-text`}>
          {t("notExpense")}
        </button>
      </div>
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
          const res = await dismissBankTransaction(id);
          if (!res.ok) throw new Error("dismiss_failed");
          toast.show({ message: t("dismissed"), tone: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

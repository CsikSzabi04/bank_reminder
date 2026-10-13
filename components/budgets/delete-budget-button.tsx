"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { deleteBudget } from "@/lib/budgets/actions";

// A keret törlése nem érinti a számlákat és a kiadásokat, csak a limitet (megerősítéssel)
export function DeleteBudgetButton({ budgetId, categoryName }: { budgetId: string; categoryName: string }) {
  const t = useTranslations("budgets");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium text-danger-text hover:bg-surface-2"
      >
        <Trash2 className="size-4" aria-hidden />
        {t("delete")}
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title={t("deleteTitle", { name: categoryName })}
        description={t("deleteBody")}
        confirmLabel={t("delete")}
        destructive
        onConfirm={async () => {
          const res = await deleteBudget(budgetId);
          if (!res.ok) throw new Error("delete failed");
          toast.show({ message: t("deleted"), tone: "success" });
          router.replace("/budgets");
        }}
      />
    </>
  );
}

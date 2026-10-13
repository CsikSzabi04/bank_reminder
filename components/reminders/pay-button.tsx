"use client";

import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

type Status = "upcoming" | "paid" | "skipped";

// "Kifizettem": optimista (az állapot azonnal vált), Visszavonás-toast, hibánál visszaáll (§14.1/4).
// A műveletek a hívótól jönnek (Server Action-ök bind-olva), így a komponens fixture-rel is kipróbálható.
export function PayButton({
  status,
  name,
  onPay,
  onUndo,
  className,
}: {
  status: Status;
  name: string;
  onPay: () => Promise<ActionState>;
  onUndo: () => Promise<ActionState>;
  className?: string;
}) {
  const t = useTranslations("reminders");
  const tc = useTranslations("common");
  const toast = useToast();
  const [shown, setShown] = useOptimistic<Status>(status);
  const [pending, startTransition] = useTransition();

  if (shown !== "upcoming") {
    // Optimista állapot: a szerver még nem frissítette a sort, de a felhasználó már látja az eredményt.
    // Kész (szerver-)állapotban a gomb helyén nincs semmi: a DueLabel mutatja az állapotot.
    return status === "upcoming" ? (
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1.5 px-3 text-sm font-medium text-success-text">
        <Check className="size-4" aria-hidden />
        {t("status.paid")}
      </span>
    ) : null;
  }

  const undo = () =>
    startTransition(async () => {
      setShown("upcoming");
      const res = await onUndo();
      if (!res.ok) toast.show({ tone: "error", message: t("payFailed") });
    });

  const pay = () =>
    startTransition(async () => {
      setShown("paid");
      const res = await onPay();
      if (!res.ok) return toast.show({ tone: "error", message: t("payFailed") });
      toast.show({ message: t("paidToast", { name }), action: { label: tc("undo"), onClick: undo } });
    });

  return (
    <button
      type="button"
      onClick={pay}
      disabled={pending}
      aria-label={t("payAria", { name })}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-control border border-border bg-surface px-3 text-sm font-medium",
        "text-primary-text hover:bg-primary-soft disabled:opacity-60",
        className,
      )}
    >
      <Check className="size-4" aria-hidden />
      {t("pay")}
    </button>
  );
}

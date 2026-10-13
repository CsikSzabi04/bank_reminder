"use client";

import { FlaskConical, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { clearDemoData, loadDemoData } from "@/lib/reminders/actions";

const BTN =
  "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

// Minta-adatok (A-30 RPC): csak a saját fiókba töltődnek, `is_demo` jelöléssel, bármikor törölhetők
export function LoadDemoButton() {
  const t = useTranslations("reminders.list");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={BTN}
      onClick={() =>
        startTransition(async () => {
          const res = await loadDemoData();
          toast.show(res.ok ? { message: t("demoLoaded") } : { tone: "error", message: t("demoFailed") });
        })
      }
    >
      <FlaskConical className="size-4" aria-hidden />
      {t("loadDemo")}
    </button>
  );
}

export function ClearDemoButton() {
  const t = useTranslations("reminders.list");
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={BTN}
      onClick={() =>
        startTransition(async () => {
          const res = await clearDemoData();
          toast.show(res.ok ? { message: t("demoCleared") } : { tone: "error", message: t("demoFailed") });
        })
      }
    >
      <Trash2 className="size-4" aria-hidden />
      {t("clearDemo")}
    </button>
  );
}

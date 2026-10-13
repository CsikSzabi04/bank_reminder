"use client";

import { useTranslations } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { toggleReminderNotify } from "@/lib/reminders/actions";
import { cn } from "@/lib/utils";

// 🔔 kapcsoló (emlékeztetőnként): role="switch", optimista, hibánál visszaáll (ref-3 toggle)
export function NotifyToggle({ reminderId, enabled, name }: { reminderId: string; enabled: boolean; name: string }) {
  const t = useTranslations("reminders");
  const toast = useToast();
  const [shown, setShown] = useOptimistic(enabled);
  const [pending, startTransition] = useTransition();

  const toggle = () =>
    startTransition(async () => {
      const next = !shown;
      setShown(next);
      const res = await toggleReminderNotify(reminderId, next);
      toast.show(res.ok ? { message: t(next ? "toast.notifyOn" : "toast.notifyOff") } : { tone: "error", message: t("toast.failed") });
    });

  return (
    // 44 px-es érintési cél, a látható kapcsoló kisebb
    <button
      type="button"
      role="switch"
      aria-checked={shown}
      aria-label={t("list.notifyToggle", { name })}
      disabled={pending}
      onClick={toggle}
      className="flex size-11 shrink-0 items-center justify-center rounded-control"
    >
      <span
        aria-hidden
        className={cn("relative h-6 w-10 rounded-full border transition-colors", shown ? "border-primary bg-primary" : "border-border bg-surface-2")}
      >
        <span
          className={cn(
            "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[left]",
            shown ? "left-[1.125rem]" : "left-0.5",
            !shown && "bg-text-muted",
          )}
        />
      </span>
    </button>
  );
}

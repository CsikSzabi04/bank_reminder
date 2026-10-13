"use client";

import { CheckCheck } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { markNotificationsRead } from "@/lib/push/actions";

export function MarkAllButton() {
  const t = useTranslations("notifications");
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(async () => void (await markNotificationsRead()))}
      className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
    >
      <CheckCheck className="size-4" aria-hidden />
      {t("markAll")}
    </button>
  );
}

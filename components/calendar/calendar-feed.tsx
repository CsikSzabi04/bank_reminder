"use client";

import { CalendarPlus, Copy, RefreshCw } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { rotateIcsToken } from "@/lib/calendar-actions";

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";

// Naptár-feed (§12.8): másolás, megnyitás (webcal://), forgatás megerősítéssel
export function CalendarFeed({ url, webcal }: { url: string; webcal: string }) {
  const t = useTranslations("calendar.feed");
  const toast = useToast();
  const [confirm, setConfirm] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.show({ message: t("copied") });
    } catch {
      toast.show({ tone: "error", message: t("copyFailed") });
    }
  };

  return (
    <section aria-labelledby="feed-title" className="flex flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 id="feed-title" className="text-lg font-semibold">
        {t("title")}
      </h2>
      <p className="text-sm text-text-2">{t("hint")}</p>
      <label className="flex flex-col gap-1.5 text-sm font-medium text-text-2">
        {t("urlLabel")}
        <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-h-12 w-full rounded-control border border-border bg-surface-2 px-3 font-mono text-xs text-text" />
      </label>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={copy}>
          <Copy className="size-4" aria-hidden />
          {t("copy")}
        </button>
        <a href={webcal} className={BTN}>
          <CalendarPlus className="size-4" aria-hidden />
          {t("open")}
        </a>
        <button type="button" className={BTN} onClick={() => setConfirm(true)}>
          <RefreshCw className="size-4" aria-hidden />
          {t("rotate")}
        </button>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title={t("rotateTitle")}
        description={t("rotateBody")}
        confirmLabel={t("rotate")}
        onConfirm={async () => {
          const res = await rotateIcsToken();
          if (!res.ok) throw new Error("rotate failed");
          toast.show({ message: t("rotated") });
        }}
      />
    </section>
  );
}

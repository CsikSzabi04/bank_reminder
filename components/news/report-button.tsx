"use client";

import { Flag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import { reportNews } from "@/lib/news/actions";

const REASONS = ["outdated", "wrong", "spam", "other"] as const;

// „Hibásnak tűnik?" (§18.3/8): ok-választás; egy felhasználó egy hírre egyszer jelenthet, ≥ 3 különböző jelentés elrejti
export function ReportButton({ newsId }: { newsId: string }) {
  const t = useTranslations("news.report");
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number]>("outdated");
  const [pending, startTransition] = useTransition();

  const submit = () =>
    startTransition(async () => {
      const res = await reportNews(newsId, reason);
      const message = res.ok ? t("thanks") : res.code === "conflict" ? t("already") : t("failed");
      toast.show({ message, tone: res.ok || res.code === "conflict" ? "success" : "error" });
      if (res.ok || res.code === "conflict") setOpen(false);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
      >
        <Flag className="size-4" aria-hidden />
        {t("open")}
      </button>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("title")} description={t("description")}>
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t("title")}</legend>
          {REASONS.map((r) => (
            <label
              key={r}
              className="flex min-h-12 cursor-pointer items-center gap-3 rounded-control border border-border px-4 has-checked:border-primary has-checked:bg-primary-soft has-focus-visible:outline-2 has-focus-visible:outline-primary"
            >
              <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-primary" />
              {t(`reasons.${r}`)}
            </label>
          ))}
        </fieldset>
        <button
          type="button"
          disabled={pending}
          onClick={submit}
          className="mt-4 min-h-12 w-full rounded-control bg-primary px-5 font-medium text-primary-fg disabled:opacity-70"
        >
          {t("send")}
        </button>
      </BottomSheet>
    </>
  );
}

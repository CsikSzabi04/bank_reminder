"use client";

import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect } from "react";
import { EmptyState } from "@/components/ui/empty-state";

// Váratlan hiba a belépett alkalmazásban: barátságos szöveg + Újra gomb. A hiba részlete nem kerül a felületre (nincs PII).
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("errors.generic");
  const tc = useTranslations("common");
  const tn = useTranslations("errors.notFound");

  useEffect(() => {
    console.error("app error", { digest: error.digest }); // csak az azonosító: a szerver-log keresi vissza
  }, [error.digest]);

  return (
    <div className="mx-auto max-w-lg py-10">
      <EmptyState icon={TriangleAlert} title={t("title")} body={t("body")}>
        <button type="button" onClick={reset} className="min-h-11 rounded-control bg-primary px-5 text-sm font-medium text-primary-fg">
          {tc("retry")}
        </button>
        <Link href="/dashboard" className="inline-flex min-h-11 items-center rounded-control border border-border bg-surface px-5 text-sm font-medium">
          {tn("home")}
        </Link>
      </EmptyState>
    </div>
  );
}

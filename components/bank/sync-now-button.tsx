"use client";

import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { refreshBankNow } from "@/lib/bank/actions";
import type { RefreshOutcome } from "@/lib/bank/service";
import type { BankErrorCode } from "@/lib/bank/types";
import { BANK_MANUAL_SYNC_MIN_HOURS } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

// „Frissítés most" a Tranzakciók szakasz tetején (a kapcsolat-kártyán is van): a 12 órás / napi 2-es korlátot a szerver tartja,
// az eredmény (elindult / túl korai / napi korlát / nem aktív / nem elérhető) érthető üzenet, aria-live-val felolvasva
export function SyncNowButton({ connectionId, timeZone }: { connectionId: string; timeZone: string }) {
  const t = useTranslations("bank");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);

  const text = (outcome: RefreshOutcome): string => {
    if (outcome.status === "too_soon") {
      if (!outcome.nextAllowedAt) return t("connection.refreshResult.too_soon_unknown", { hours: BANK_MANUAL_SYNC_MIN_HOURS });
      const time = `${formatDate(outcome.nextAllowedAt, locale, timeZone)} ${formatTime(outcome.nextAllowedAt, locale, timeZone)}`;
      return t("connection.refreshResult.too_soon", { time });
    }
    return t(`connection.refreshResult.${outcome.status}`);
  };

  const run = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await refreshBankNow(connectionId);
      if (res.ok && res.data) {
        setMessage({ text: text(res.data), tone: res.data.status === "queued" ? "info" : "error" });
        if (res.data.status === "queued") router.refresh();
        return;
      }
      setMessage({ text: t(`error.${(res.ok ? "unknown" : (res.reason ?? "unknown")) as BankErrorCode}`), tone: "error" });
    });

  return (
    <div className="flex flex-col gap-2">
      <div>
        <button
          type="button"
          disabled={pending}
          aria-busy={pending}
          onClick={run}
          className="inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
        >
          <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} aria-hidden />
          {pending ? t("connection.refreshing") : t("connection.refresh")}
        </button>
      </div>
      <p aria-live="polite" className={message?.tone === "error" ? "text-sm text-danger-text" : "text-sm text-text-2"}>
        {message?.text}
      </p>
    </div>
  );
}

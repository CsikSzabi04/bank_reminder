"use client";

import { Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { BANK_MANUAL_SYNC_MIN_HOURS } from "@/lib/constants";
import { disconnectBank, refreshBankNow, startBankConnection } from "@/lib/bank/actions";
import type { RefreshOutcome } from "@/lib/bank/service";
import type { BankErrorCode } from "@/lib/bank/types";
import { formatDate, formatTime } from "@/lib/format";
import type { Locale } from "@/lib/i18n/config";

const BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-60";

type Props = {
  connectionId: string;
  aspspName: string;
  aspspCountry: string;
  // csak aktív kapcsolatnál van értelme a kézi frissítésnek
  canRefresh: boolean;
  timeZone: string;
};

// Újra-hitelesítés (mindig elérhető) · Frissítés most (12 órás korlát magyarázattal) · Kapcsolat törlése (megerősítéssel).
// Az `aria-live` régió az eredményt felolvassa; a hiba-szöveg a `bank.error.*`-ból jön (a szerver üzenete nem kerül a felületre).
export function ConnectionActions({ connectionId, aspspName, aspspCountry, canRefresh, timeZone }: Props) {
  const t = useTranslations("bank");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; tone: "info" | "error" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const errorText = (reason: string | undefined) => t(`error.${(reason ?? "unknown") as BankErrorCode}`);

  const reauth = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await startBankConnection({ aspspName, aspspCountry, renewConnectionId: connectionId });
      if (res.ok && res.data) {
        window.location.assign(res.data.url);
        return;
      }
      setMessage({ text: errorText(res.ok ? undefined : res.reason), tone: "error" });
    });

  const refreshText = (outcome: RefreshOutcome): string => {
    if (outcome.status === "too_soon") {
      if (!outcome.nextAllowedAt) return t("connection.refreshResult.too_soon_unknown", { hours: BANK_MANUAL_SYNC_MIN_HOURS });
      const time = `${formatDate(outcome.nextAllowedAt, locale, timeZone)} ${formatTime(outcome.nextAllowedAt, locale, timeZone)}`;
      return t("connection.refreshResult.too_soon", { time });
    }
    return t(`connection.refreshResult.${outcome.status}`);
  };

  const refresh = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await refreshBankNow(connectionId);
      if (res.ok && res.data) {
        setMessage({ text: refreshText(res.data), tone: res.data.status === "queued" ? "info" : "error" });
        if (res.data.status === "queued") router.refresh();
        return;
      }
      setMessage({ text: errorText(res.ok ? undefined : res.reason), tone: "error" });
    });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} onClick={reauth} className={BTN}>
          {t("connection.reauth")}
        </button>
        {canRefresh && (
          <button type="button" disabled={pending} aria-busy={pending} onClick={refresh} className={BTN}>
            {pending ? t("connection.refreshing") : t("connection.refresh")}
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirmDelete(true)}
          className={`${BTN} text-danger-text`}
        >
          <Trash2 className="size-4" aria-hidden />
          {t("connection.delete")}
        </button>
      </div>
      {canRefresh && <p className="text-sm text-text-2">{t("connection.refreshHint", { hours: BANK_MANUAL_SYNC_MIN_HOURS })}</p>}
      <p aria-live="polite" className={message?.tone === "error" ? "text-sm text-danger-text" : "text-sm text-text-2"}>
        {message?.text}
      </p>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={t("connection.deleteTitle")}
        description={t("connection.deleteBody")}
        confirmLabel={t("connection.deleteConfirm")}
        destructive
        onConfirm={async () => {
          const res = await disconnectBank(connectionId);
          if (!res.ok) throw new Error("disconnect_failed");
          toast.show({ message: t("connection.deleted"), tone: "success" });
          router.refresh();
        }}
      />
    </div>
  );
}

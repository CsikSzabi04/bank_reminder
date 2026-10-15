"use client";

import { ExternalLink, Landmark } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { startBankConnection } from "@/lib/bank/actions";
import type { Aspsp, BankErrorCode } from "@/lib/bank/types";
import { ENABLE_BANKING_URL } from "@/lib/constants";

// Összekötés indítása (advanced.md §8.2): bank kiválasztása → a szerver `state`-et készít és visszaadja a bank URL-jét → átirányítás.
// A jóváhagyást a felhasználónak a bank saját appjában/oldalán kell megtennie — ezt a szöveg ki is mondja.
export function ConnectPanel({
  banks,
  listError,
  another,
}: {
  banks: Aspsp[];
  // a bank-lista betöltési hibája (az Edge Function kódja); ilyenkor a választó helyén magyarázat van
  listError: BankErrorCode | null;
  // van már összekötött bank → „Újabb bank" cím
  another: boolean;
}) {
  const t = useTranslations("bank");
  const selectId = useId();
  const [selected, setSelected] = useState("");
  const [error, setError] = useState<BankErrorCode | null>(null);
  const [pending, startTransition] = useTransition();
  const bank = banks.find((b) => `${b.country}:${b.name}` === selected);

  const start = () => {
    if (!bank) return;
    setError(null);
    startTransition(async () => {
      const res = await startBankConnection({ aspspName: bank.name, aspspCountry: bank.country });
      if (res.ok && res.data) {
        // külső átirányítás: a bank oldalán a felhasználó jóváhagy, majd a /bank/callback-re érkezik vissza
        window.location.assign(res.data.url);
        return;
      }
      setError((res.ok ? "unknown" : (res.reason as BankErrorCode | undefined)) ?? "unknown");
    });
  };

  return (
    <section className="flex flex-col gap-4 rounded-card border border-border bg-surface p-5 shadow-card">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <Landmark className="size-5 text-text-2" aria-hidden />
        {t(another ? "connect.titleAnother" : "connect.title")}
      </h2>
      <p className="text-text-2">{t("connect.lead")}</p>

      <ol aria-label={t("connect.stepsLabel")} className="flex list-decimal flex-col gap-1 pl-5">
        <li>{t("connect.step1")}</li>
        <li>{t("connect.step2")}</li>
        <li>{t("connect.step3")}</li>
      </ol>
      <p className="rounded-control bg-surface-2 p-3 text-sm font-medium">{t("connect.warning")}</p>

      {listError ? (
        <p role="alert" className="text-danger-text">
          {t("connect.listError")} {t(`error.${listError}`)}
        </p>
      ) : banks.length === 0 ? (
        <p className="text-text-2">{t("connect.listEmpty")}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor={selectId} className="text-sm font-medium">
            {t("connect.bankLabel")}
          </label>
          <select
            id={selectId}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="min-h-11 rounded-control border border-border bg-surface px-3"
          >
            <option value="">{t("connect.bankPlaceholder")}</option>
            {banks.map((b) => (
              <option key={`${b.country}:${b.name}`} value={`${b.country}:${b.name}`}>
                {b.name}
              </option>
            ))}
          </select>
          {bank?.maxConsentDays ? <p className="text-sm text-text-2">{t("connect.maxDays", { days: bank.maxConsentDays })}</p> : null}
        </div>
      )}

      {error && (
        <p role="alert" className="text-danger-text">
          {t(`error.${error}`)}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!bank || pending}
          aria-busy={pending}
          onClick={start}
          className="min-h-12 rounded-control bg-primary px-5 font-medium text-primary-fg disabled:opacity-60"
        >
          {pending ? t("connect.pending") : t("connect.cta")}
        </button>
        <a
          href={ENABLE_BANKING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary-text underline-offset-2 hover:underline"
        >
          {t("connect.enableLink")}
          <ExternalLink className="size-4" aria-hidden />
        </a>
      </div>
    </section>
  );
}

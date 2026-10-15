"use client";

import { LocateFixed } from "lucide-react";
import { useTranslations } from "next-intl";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Notice } from "@/components/auth/notice";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import { useReminderErrorText } from "@/components/reminders/form/use-reminder-error";
import { saveFinance } from "@/lib/profile/finance-actions";
import { CURRENCIES } from "@/lib/schemas/reminder";

const noop = () => () => {};
const EMPTY: string[] = [];
// a useSyncExternalStore-nak stabil (gyorsítótárazott) hivatkozás kell, különben végtelen újrarenderelés lenne
let zoneCache: string[] | null = null;
const zones = (): string[] => {
  if (zoneCache) return zoneCache;
  try {
    zoneCache = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? EMPTY;
  } catch {
    zoneCache = EMPTY;
  }
  return zoneCache;
};
const detect = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "";

// Pénzügyek (§19.1): alap-pénznem · időzóna (automatikus felismerés + kézi) · opcionális havi jövedelem (csak a tippekhez)
export function FinanceForm({ currency, timezone, income }: { currency: string; timezone: string; income: string }) {
  const t = useTranslations("profile.finance");
  const errorText = useReminderErrorText();
  const [state, action] = useActionState(saveFinance, null);
  const [cur, setCur] = useState(currency);
  const [tz, setTz] = useState(timezone);
  const [inc, setInc] = useState(income);
  const options = useSyncExternalStore(noop, zones, () => EMPTY);
  const detected = useSyncExternalStore(noop, detect, () => "");
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-sm font-medium text-text-2">
        {t("currency")}
        <select name="currency" value={cur} onChange={(e) => setCur(e.target.value)} className="min-h-12 rounded-control border border-border bg-surface-2 px-3 text-base font-normal text-text">
          {CURRENCIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <span className="text-sm font-normal text-text-muted">{t("currencyHint")}</span>
      </label>

      <div className="flex flex-col gap-2">
        <TextField
          name="timezone"
          label={t("timezone")}
          list="tz-options"
          autoComplete="off"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          errors={fe?.timezone}
          translateError={errorText}
          required
        />
        <datalist id="tz-options">
          {options.map((z) => (
            <option key={z} value={z} />
          ))}
        </datalist>
        {detected && detected !== tz && (
          <button
            type="button"
            onClick={() => setTz(detected)}
            className="inline-flex min-h-11 w-fit items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2"
          >
            <LocateFixed className="size-4" aria-hidden />
            {t("detect", { zone: detected })}
          </button>
        )}
      </div>

      <TextField
        name="income"
        label={t("income")}
        hint={t("optional")}
        inputMode="decimal"
        autoComplete="off"
        value={inc}
        onChange={(e) => setInc(e.target.value)}
        errors={fe?.income}
        translateError={errorText}
      />
      <p className="-mt-2 text-sm text-text-2">{t("incomeHint")}</p>

      <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
      {state?.ok && <Notice variant="success">{t("saved")}</Notice>}
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

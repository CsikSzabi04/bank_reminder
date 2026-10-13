"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { LanguageSwitch } from "@/components/shell/language-switch";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { saveBasics } from "@/lib/onboarding/actions";
import { CURRENCIES } from "@/lib/schemas/reminder";
import { TimezoneField } from "./timezone-field";

// 1. lépés (§14.11): nyelv + téma (élő előnézet a saját kapcsolóikkal), alap-pénznem, időzóna automatikusan
export function BasicsForm({ currency, timezone }: { currency: string; timezone: string }) {
  const t = useTranslations("onboarding");
  const [state, action] = useActionState(saveBasics, null);
  const [cur, setCur] = useState(currency);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4">
        <LanguageSwitch />
        <ThemeSwitch />
      </div>
      <form action={action} noValidate className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-text-2">
          {t("currency")}
          <select
            name="currency"
            value={cur}
            onChange={(e) => setCur(e.target.value)}
            className="min-h-12 rounded-control border border-border bg-surface-2 px-3 text-base font-normal text-text"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <TimezoneField fallback={timezone} />
        <FormAlert state={state} />
        <SubmitButton pendingLabel={t("saving")}>{t("next")}</SubmitButton>
      </form>
    </div>
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import { useReminderErrorText } from "@/components/reminders/form/use-reminder-error";
import { saveBudget } from "@/lib/budgets/actions";

// Új / meglévő keret: kategória fix (az URL-ből), az összeg a javasolt értékkel előtöltve (§16.1)
export function BudgetForm({
  categoryId,
  initialLimit,
  suggestionText,
}: {
  categoryId: string;
  /** szerkesztésnél a mostani keret, újnál a javasolt (vagy üres) */
  initialLimit: string;
  suggestionText?: string;
}) {
  const t = useTranslations("budgets");
  const errorText = useReminderErrorText();
  const [state, action] = useActionState(saveBudget, null);
  // kontrollált mező: a React 19 az akció után az nem-kontrollált mezőket alaphelyzetbe állítja, hibánál elveszne a beírt érték
  const [limit, setLimit] = useState(initialLimit);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-3">
      <input type="hidden" name="categoryId" value={categoryId} />
      <TextField
        name="limit"
        label={t("limit")}
        inputMode="decimal"
        autoComplete="off"
        value={limit}
        onChange={(e) => setLimit(e.target.value)}
        errors={fe?.limit ?? fe?.categoryId}
        translateError={errorText}
        required
      />
      {suggestionText && <p className="text-sm text-text-2">{suggestionText}</p>}
      <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

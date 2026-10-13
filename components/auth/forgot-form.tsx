"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { requestPasswordReset } from "@/app/(auth)/forgot-password/actions";
import { FormAlert } from "./form-alert";
import { Notice } from "./notice";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { useFocusFirstError } from "./use-focus-first-error";

export function ForgotForm({ linkExpired }: { linkExpired?: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(requestPasswordReset, null);
  const [email, setEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);

  // mindig ugyanaz a válasz: nem derül ki, hogy létezik-e a fiók
  if (state?.ok) return <Notice variant="success">{t("reset.sent")}</Notice>;

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      {linkExpired && !state && <Notice variant="error">{t("error.linkExpired")}</Notice>}
      <FormAlert state={state} />
      <TextField
        name="email"
        type="email"
        label={t("field.email")}
        autoComplete="email"
        inputMode="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        errors={fieldErrors?.email}
        required
      />
      <SubmitButton pendingLabel={t("forgot.pending")}>{t("forgot.submit")}</SubmitButton>
    </form>
  );
}

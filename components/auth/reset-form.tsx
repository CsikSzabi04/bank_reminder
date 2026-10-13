"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { updatePassword } from "@/app/(auth)/reset-password/actions";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";
import { PasswordStrength } from "./password-strength";
import { SubmitButton } from "./submit-button";
import { useFocusFirstError } from "./use-focus-first-error";

export function ResetForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(updatePassword, null);
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      <FormAlert state={state} />
      <div className="flex flex-col gap-3">
        <PasswordField
          name="password"
          label={t("field.newPassword")}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errors={fieldErrors?.password}
          required
        />
        <PasswordStrength password={password} />
      </div>
      <PasswordField
        name="confirm"
        label={t("field.confirmPassword")}
        autoComplete="new-password"
        errors={fieldErrors?.confirm}
        required
      />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="signOutOthers" className="size-5 accent-primary" />
        {t("reset.signOutOthers")}
      </label>
      <SubmitButton pendingLabel={t("reset.pending")}>{t("reset.submit")}</SubmitButton>
    </form>
  );
}

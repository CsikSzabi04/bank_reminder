"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Notice } from "@/components/auth/notice";
import { PasswordField } from "@/components/auth/password-field";
import { PasswordStrength } from "@/components/auth/password-strength";
import { SubmitButton } from "@/components/auth/submit-button";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import { changePassword } from "@/lib/profile/security-actions";

// Jelszó módosítása (§19.1): új jelszó + megerősítés; a mezők kontrolláltak (hibánál megmaradnak), siker után kiürülnek
export function PasswordForm() {
  const t = useTranslations("profile.security");
  const ta = useTranslations("auth");
  const [state, action] = useActionState(changePassword, null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [seen, setSeen] = useState(state);
  // siker után az új állapotra váltáskor kiürítjük a mezőket (render közbeni származtatott állapot, nem effekt)
  if (state !== seen) {
    setSeen(state);
    if (state?.ok) {
      setPassword("");
      setConfirm("");
    }
  }
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      <h3 className="text-base font-semibold">{t("password.title")}</h3>
      <FormAlert state={state} />
      {state?.ok && <Notice variant="success">{t("password.saved")}</Notice>}
      <div className="flex flex-col gap-3">
        <PasswordField name="password" label={ta("field.newPassword")} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} errors={fe?.password} required />
        <PasswordStrength password={password} />
      </div>
      <PasswordField name="confirm" label={ta("field.confirmPassword")} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} errors={fe?.confirm} required />
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" name="signOutOthers" className="size-5 accent-primary" />
        {ta("reset.signOutOthers")}
      </label>
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel={t("saving")}>{t("password.submit")}</SubmitButton>
      </div>
    </form>
  );
}

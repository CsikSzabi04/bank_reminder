"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { Notice } from "@/components/auth/notice";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import { useFieldErrorText } from "@/components/auth/use-field-error";
import { changeEmail } from "@/lib/profile/security-actions";

// E-mail módosítása (§19.1): megerősítő levél megy az új címre; a régi cím addig él, amíg nem erősít
export function EmailForm({ current }: { current: string }) {
  const t = useTranslations("profile.security");
  const authErrorText = useFieldErrorText();
  const [state, action] = useActionState(changeEmail, null);
  const [email, setEmail] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4 border-t border-border pt-5">
      <h3 className="text-base font-semibold">{t("email.title")}</h3>
      <p className="text-sm text-text-2">{t("email.current", { email: current })}</p>
      <FormAlert state={state} />
      {state?.ok && <Notice variant="success">{t("email.sent")}</Notice>}
      <TextField
        name="email"
        type="email"
        label={t("email.new")}
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        errors={fe?.email}
        translateError={(code) => (code === "sameEmail" ? t("email.same") : authErrorText(code))}
        required
      />
      <p className="text-sm text-text-2">{t("email.hint")}</p>
      <div className="sm:max-w-56">
        <SubmitButton pendingLabel={t("saving")}>{t("email.submit")}</SubmitButton>
      </div>
    </form>
  );
}

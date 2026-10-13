"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { TextField } from "@/components/auth/text-field";
import { Notice } from "@/components/auth/notice";
import { FormAlert } from "@/components/auth/form-alert";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import { updateDisplayName } from "@/lib/profile/actions";
import { SubmitButton } from "@/components/auth/submit-button";

export function NameForm({ initialName }: { initialName: string }) {
  const t = useTranslations("profile.overview.name");
  const [state, action] = useActionState(updateDisplayName, null);
  const [name, setName] = useState(initialName);
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-3">
      <TextField
        name="displayName"
        label={t("label")}
        autoComplete="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        errors={fieldErrors?.displayName}
        maxLength={60}
        required
      />
      <FormAlert state={state} />
      {state?.ok && <Notice variant="success">{t("saved")}</Notice>}
      <div className="sm:max-w-40">
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

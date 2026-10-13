"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { resendConfirmation } from "@/app/(auth)/check-email/actions";
import type { ActionState } from "@/lib/action-state";
import { FormAlert } from "./form-alert";
import { Notice } from "./notice";
import { TextField } from "./text-field";
import { useFocusFirstError } from "./use-focus-first-error";

const COOLDOWN_SECONDS = 60;

// Újraküldés 60 mp-es várakozással (§10.8: over_email_send_rate_limit + visszaszámlálás)
export function ResendForm({ email }: { email?: string }) {
  const t = useTranslations("auth");
  const [seconds, setSeconds] = useState(COOLDOWN_SECONDS);
  const [address, setAddress] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const [state, action, pending] = useActionState(
    async (prev: ActionState | null, formData: FormData): Promise<ActionState> => {
      const result = await resendConfirmation(prev, formData);
      if (result.ok) setSeconds(COOLDOWN_SECONDS);
      return result;
    },
    null,
  );
  useFocusFirstError(state, formRef);

  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const waiting = seconds > 0;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      {state?.ok && <Notice variant="success">{t("checkEmail.resent")}</Notice>}
      <FormAlert state={state} />
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <TextField
          name="email"
          type="email"
          label={t("field.email")}
          autoComplete="email"
          inputMode="email"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          errors={fieldErrors?.email}
          required
        />
      )}
      <button
        type="submit"
        disabled={waiting || pending}
        className="min-h-12 w-full rounded-control border border-border bg-surface px-5 font-medium text-text disabled:opacity-60"
      >
        {waiting ? t("checkEmail.resendIn", { seconds }) : t("checkEmail.resend")}
      </button>
    </form>
  );
}

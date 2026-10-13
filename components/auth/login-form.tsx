"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { signIn } from "@/app/(auth)/login/actions";
import { FormAlert } from "./form-alert";
import { Notice } from "./notice";
import { PasswordField } from "./password-field";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { useFocusFirstError } from "./use-focus-first-error";
import { useStandalone } from "./use-standalone";

export function LoginForm({ next, linkExpired }: { next?: string; linkExpired?: boolean }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(signIn, null);
  const [email, setEmail] = useState("");
  const standalone = useStandalone();
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const needsConfirm = state && !state.ok && state.reason === "emailNotConfirmed";

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      {linkExpired && !state && <Notice variant="error">{t("error.linkExpired")}</Notice>}
      <FormAlert state={state} />
      {needsConfirm && (
        <Link
          href={`/check-email?type=signup&e=${encodeURIComponent(email)}`}
          className="text-sm font-medium text-primary-text underline"
        >
          {t("checkEmail.resend")}
        </Link>
      )}

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
      <PasswordField
        name="password"
        label={t("field.password")}
        autoComplete="current-password"
        errors={fieldErrors?.password}
        required
      />

      <div className="flex flex-wrap items-center justify-between gap-x-4">
        {standalone ? (
          // telepített appban mindig bejelentkezve marad (§10.3)
          <input type="hidden" name="remember" value="on" />
        ) : (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" name="remember" defaultChecked className="size-5 accent-primary" />
            {t("login.stay")}
          </label>
        )}
        <Link href="/forgot-password" className="flex min-h-11 items-center text-sm font-medium text-primary-text underline">
          {t("login.forgot")}
        </Link>
      </div>

      <SubmitButton pendingLabel={t("login.pending")}>{t("login.submit")}</SubmitButton>
    </form>
  );
}

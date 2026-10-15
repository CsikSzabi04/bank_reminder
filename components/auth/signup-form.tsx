"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { signUp } from "@/app/(auth)/signup/actions";
import { LOCALES } from "@/lib/i18n/config";
import { FormAlert } from "./form-alert";
import { PasswordField } from "./password-field";
import { PasswordStrength } from "./password-strength";
import { SubmitButton } from "./submit-button";
import { TextField } from "./text-field";
import { useFieldErrorText } from "./use-field-error";
import { useFocusFirstError } from "./use-focus-first-error";

export function SignupForm() {
  const t = useTranslations("auth");
  const tl = useTranslations("common.language");
  const locale = useLocale();
  const errorText = useFieldErrorText();
  const [state, action] = useActionState(signUp, null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fieldErrors = state && !state.ok ? state.fieldErrors : undefined;
  const acceptError = fieldErrors?.accept?.[0];

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      <FormAlert state={state} />

      <TextField
        name="displayName"
        label={t("field.displayName")}
        autoComplete="name"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        errors={fieldErrors?.displayName}
        maxLength={60}
        required
      />
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
      <div className="flex flex-col gap-3">
        <PasswordField
          name="password"
          label={t("field.password")}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          errors={fieldErrors?.password}
          required
        />
        <PasswordStrength password={password} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="signup-locale" className="text-sm font-medium text-text-2">
          {t("field.language")}
        </label>
        <select
          id="signup-locale"
          name="locale"
          defaultValue={locale}
          className="min-h-12 rounded-control border border-border bg-surface-2 px-4 text-text"
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {tl(l)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex min-h-11 items-start gap-3 py-1.5 text-sm">
          <input
            type="checkbox"
            name="accept"
            aria-invalid={acceptError ? true : undefined}
            aria-describedby={acceptError ? "accept-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-primary"
          />
          <span>
            {t.rich("signup.acceptRich", {
              privacy: (chunks) => (
                <Link href="/privacy" target="_blank" rel="noopener" className="font-medium text-primary-text underline">
                  {chunks}
                </Link>
              ),
              terms: (chunks) => (
                <Link href="/terms" target="_blank" rel="noopener" className="font-medium text-primary-text underline">
                  {chunks}
                </Link>
              ),
            })}
          </span>
        </label>
        {acceptError && (
          <p id="accept-error" className="text-sm text-danger-text">
            {errorText(acceptError)}
          </p>
        )}
      </div>

      <SubmitButton pendingLabel={t("signup.pending")}>{t("signup.submit")}</SubmitButton>
    </form>
  );
}

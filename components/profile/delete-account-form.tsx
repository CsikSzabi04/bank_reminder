"use client";

import { TriangleAlert } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useActionState, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { TextField } from "@/components/auth/text-field";
import { useFormStatus } from "react-dom";
import { deleteAccount } from "@/lib/profile/delete-account";

function DangerButton({ enabled, label, pendingLabel }: { enabled: boolean; label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={!enabled || pending} className="min-h-12 rounded-control bg-danger px-5 font-medium text-white disabled:opacity-50">
      {pending ? pendingLabel : label}
    </button>
  );
}

// Veszélyzóna (§19.4): a megerősítő szót be kell gépelni (HU: TÖRLÖM, EN: DELETE); a gomb addig tiltott
export function DeleteAccountForm() {
  const t = useTranslations("profile.data.delete");
  const word = useLocale() === "en" ? "DELETE" : "TÖRLÖM";
  const [state, action] = useActionState(deleteAccount, null);
  const [typed, setTyped] = useState("");
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-card border border-danger/40 bg-danger/10 p-4">
        <TriangleAlert className="mt-0.5 size-5 shrink-0 text-danger-text" aria-hidden />
        <p className="text-sm">{t("warning")}</p>
      </div>
      <TextField
        name="confirm"
        label={t("confirmLabel", { word })}
        autoComplete="off"
        autoCapitalize="characters"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        errors={fe?.confirm}
        translateError={() => t("mismatch", { word })}
      />
      <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
      {state && !state.ok && !state.fieldErrors && <p role="alert" className="text-danger-text">{t("failed")}</p>}
      <div className="sm:max-w-64">
        <DangerButton enabled={typed.trim().toLocaleUpperCase("hu") === word} label={t("submit")} pendingLabel={t("deleting")} />
      </div>
    </form>
  );
}

"use client";

import { Minus, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useActionState, useEffect, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { useReminderErrorText } from "@/components/reminders/form/use-reminder-error";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/action-state";
import { addContribution } from "@/lib/savings/actions";

const BTN = "inline-flex min-h-11 items-center gap-2 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2";

// Hozzáadás / kivét lap: összeg + dátum (ma) + megjegyzés. A kivét a szerveren az összegyűltre korlátozott.
export function ContributionSheet({ goalId, goalName, mode, today }: { goalId: string; goalName: string; mode: "add" | "withdraw"; today: string }) {
  const t = useTranslations("savings");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [state, action] = useActionState(addContribution.bind(null, goalId), null);
  const handled = useRef<typeof state>(null);
  const Icon = mode === "add" ? Plus : Minus;

  useEffect(() => {
    if (!state?.ok || handled.current === state) return;
    handled.current = state;
    toast.show({ message: t(mode === "add" ? "added" : "withdrawn"), tone: "success" });
    setResetKey((k) => k + 1);
    setOpen(false);
    router.refresh();
  }, [state, toast, t, mode, router]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={BTN}>
        <Icon className="size-4" aria-hidden />
        {t(mode === "add" ? "add" : "withdraw")}
      </button>
      <BottomSheet
        open={open}
        onClose={() => setOpen(false)}
        title={t(mode === "add" ? "addTitle" : "withdrawTitle", { name: goalName })}
      >
        <ContributionForm key={resetKey} action={action} state={state} mode={mode} today={today} />
      </BottomSheet>
    </>
  );
}

type SheetState = ReturnType<typeof useActionState<ActionState | null, FormData>>[0];

// Kontrollált mezők: hibás beküldés után a beírt értékek megmaradnak (a React 19 az nem-kontrollált mezőket visszaállítja)
function ContributionForm({ action, state, mode, today }: { action: (fd: FormData) => void; state: SheetState; mode: "add" | "withdraw"; today: string }) {
  const t = useTranslations("savings");
  const errorText = useReminderErrorText();
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="direction" value={mode} />
      <TextField name="amount" label={t("amount")} inputMode="decimal" autoComplete="off" autoFocus value={amount} onChange={(e) => setAmount(e.target.value)} errors={fe?.amount} translateError={errorText} required />
      <TextField name="contributedOn" type="date" label={t("date")} value={date} onChange={(e) => setDate(e.target.value)} max={today} errors={fe?.contributedOn} translateError={errorText} required />
      <TextField name="note" label={t("note")} hint={t("optional")} maxLength={200} autoComplete="off" value={note} onChange={(e) => setNote(e.target.value)} errors={fe?.note} translateError={errorText} />
      <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
      <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
    </form>
  );
}

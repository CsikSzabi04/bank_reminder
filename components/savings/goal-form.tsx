"use client";

import { useTranslations } from "next-intl";
import { useActionState, useRef, useState } from "react";
import { FormAlert } from "@/components/auth/form-alert";
import { SubmitButton } from "@/components/auth/submit-button";
import { TextField } from "@/components/auth/text-field";
import { useFocusFirstError } from "@/components/auth/use-focus-first-error";
import { useReminderErrorText } from "@/components/reminders/form/use-reminder-error";
import { categoryColorVar } from "@/lib/category-icons";
import { saveGoal } from "@/lib/savings/actions";
import { GOAL_COLOR_SLOTS, GOAL_ICONS, GOAL_ICON_KEYS } from "@/lib/savings/icons";
import { cn } from "@/lib/utils";

export type GoalFormValues = { name: string; target: string; targetDate: string; icon: string; colorSlot: number };

// Új / szerkesztett cél. A pénznem az alap-pénznem (nem választható); az ikon és a szín rádió-csoport (billentyűvel is állítható).
export function GoalForm({ goalId, initial, minDate }: { goalId: string | null; initial: GoalFormValues; minDate: string }) {
  const t = useTranslations("savings");
  const errorText = useReminderErrorText();
  const [state, action] = useActionState(saveGoal.bind(null, goalId), null);
  // kontrollált mezők: hibás beküldés után a beírt értékek megmaradnak (a React 19 az nem-kontrollált mezőket visszaállítja)
  const [v, setV] = useState(initial);
  const patch = (p: Partial<GoalFormValues>) => setV((cur) => ({ ...cur, ...p }));
  const formRef = useRef<HTMLFormElement>(null);
  useFocusFirstError(state, formRef);
  const fe = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <form ref={formRef} action={action} noValidate className="flex flex-col gap-4">
      <TextField name="name" label={t("name")} value={v.name} onChange={(e) => patch({ name: e.target.value })} maxLength={60} errors={fe?.name} translateError={errorText} required />
      <TextField name="target" label={t("target")} inputMode="decimal" autoComplete="off" value={v.target} onChange={(e) => patch({ target: e.target.value })} errors={fe?.target} translateError={errorText} required />
      <TextField
        name="targetDate"
        type="date"
        label={t("targetDate")}
        hint={t("optional")}
        value={v.targetDate}
        onChange={(e) => patch({ targetDate: e.target.value })}
        min={minDate}
        errors={fe?.targetDate}
        translateError={errorText}
      />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">{t("icon")}</legend>
        <div className="flex flex-wrap gap-2">
          {GOAL_ICON_KEYS.map((key) => {
            const Icon = GOAL_ICONS[key];
            return (
              <label
                key={key}
                className="flex size-12 cursor-pointer items-center justify-center rounded-control border border-border bg-surface text-text-2 has-checked:border-primary has-checked:bg-primary-soft has-checked:text-primary-text has-focus-visible:outline-2 has-focus-visible:outline-primary"
              >
                <input type="radio" name="icon" value={key} checked={v.icon === key}
                  onChange={() => patch({ icon: key })} className="sr-only" aria-label={t(`icons.${key}`)} />
                <Icon className="size-5" aria-hidden />
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">{t("color")}</legend>
        <div className="flex flex-wrap gap-2">
          {GOAL_COLOR_SLOTS.map((slot) => (
            <label
              key={slot}
              className={cn(
                "flex size-11 cursor-pointer items-center justify-center rounded-full border-2 border-transparent",
                "has-checked:border-text has-focus-visible:outline-2 has-focus-visible:outline-primary",
              )}
            >
              <input type="radio" name="colorSlot" value={slot} checked={v.colorSlot === slot}
                onChange={() => patch({ colorSlot: slot })} className="sr-only" aria-label={t("colorN", { n: slot })} />
              <span aria-hidden className="size-7 rounded-full" style={{ background: categoryColorVar(slot) }} />
            </label>
          ))}
        </div>
      </fieldset>

      <FormAlert state={state && !state.ok && state.fieldErrors ? null : state} />
      <div className="sm:max-w-48">
        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </div>
    </form>
  );
}

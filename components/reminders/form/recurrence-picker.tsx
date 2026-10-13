"use client";

import { useTranslations } from "next-intl";
import { TextField } from "@/components/auth/text-field";
import { RECUR_UNITS, RECURRENCE_MODES, type RecurrenceMode } from "@/lib/schemas/reminder";
import type { FormValues } from "@/lib/reminders/form-values";
import { cn } from "@/lib/utils";

type Props = {
  values: Pick<FormValues, "recurrence" | "recurEvery" | "recurUnit" | "startDate" | "monthEnd">;
  onChange: (patch: Partial<FormValues>) => void;
  errors: { startDate?: string[]; recurEvery?: string[]; recurUnit?: string[] };
  translateError: (code: string | undefined) => string;
};

// Ismétlődés: Egyszeri · Hetente · Havonta · Évente · Egyéni (natív rádiók: billentyűzet + olvasó beépítve)
export function RecurrencePicker({ values, onChange, errors, translateError }: Props) {
  const t = useTranslations("reminders.form");
  const tr = useTranslations("reminders.form.recurrence");
  const unitLabel = (u: (typeof RECUR_UNITS)[number]) =>
    u === "day" ? tr("unitDay", { n: values.recurEvery }) : u === "week" ? tr("unitWeek", { n: values.recurEvery }) : u === "month" ? tr("unitMonth", { n: values.recurEvery }) : tr("unitYear", { n: values.recurEvery });

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-medium text-text-2">{tr("label")}</legend>
        <div className="flex flex-wrap gap-2">
          {RECURRENCE_MODES.map((mode: RecurrenceMode) => {
            const on = values.recurrence === mode;
            return (
              <label
                key={mode}
                className={cn(
                  "flex min-h-11 cursor-pointer items-center rounded-full border px-4 text-sm font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                  on ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-surface text-text-2 hover:bg-surface-2",
                )}
              >
                <input
                  type="radio"
                  name="recurrence"
                  value={mode}
                  checked={on}
                  onChange={() => onChange({ recurrence: mode })}
                  className="sr-only"
                />
                {tr(mode)}
              </label>
            );
          })}
        </div>
      </fieldset>

      {values.recurrence === "custom" && (
        <div className="flex items-end gap-3">
          <div className="w-28">
            <TextField
              name="recurEvery"
              type="number"
              inputMode="numeric"
              min={1}
              max={60}
              label={tr("every")}
              value={values.recurEvery}
              onChange={(e) => onChange({ recurEvery: Number(e.target.value) })}
              errors={errors.recurEvery}
              translateError={translateError}
            />
          </div>
          <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium text-text-2">
            {tr("unit")}
            <select
              name="recurUnit"
              value={values.recurUnit}
              onChange={(e) => onChange({ recurUnit: e.target.value as FormValues["recurUnit"] })}
              className="min-h-12 rounded-control border border-border bg-surface-2 px-4 text-text"
            >
              {RECUR_UNITS.map((u) => (
                <option key={u} value={u}>
                  {unitLabel(u)}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      <TextField
        name="startDate"
        type="date"
        label={t("firstDue")}
        value={values.startDate}
        onChange={(e) => onChange({ startDate: e.target.value })}
        errors={errors.startDate}
        translateError={translateError}
        required
      />

      {values.recurrence === "month" && (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="monthEnd"
            checked={values.monthEnd}
            onChange={(e) => onChange({ monthEnd: e.target.checked })}
            className="size-5 accent-primary"
          />
          {t("monthEnd")}
        </label>
      )}
    </div>
  );
}

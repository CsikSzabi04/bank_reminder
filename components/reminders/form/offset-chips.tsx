"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { MAX_OFFSET_DAYS, MAX_OFFSETS, OFFSET_CHOICES } from "@/lib/schemas/reminder";
import { cn } from "@/lib/utils";

// "Mikor szóljunk?": aznap · 1 · 2 · 3 · 7 nap (többes, max. 5) + egyéni szám (§14.6)
export function OffsetChips({
  offsets,
  onChange,
  error,
}: {
  offsets: number[];
  onChange: (next: number[]) => void;
  error?: string;
}) {
  const t = useTranslations("reminders.form");
  const [custom, setCustom] = useState("");
  const full = offsets.length >= MAX_OFFSETS;
  const sorted = [...offsets].sort((a, b) => a - b);
  const label = (n: number) => (n === 0 ? t("sameDay") : t("daysBefore", { n }));

  const toggle = (n: number) =>
    onChange(offsets.includes(n) ? offsets.filter((o) => o !== n) : full ? offsets : [...offsets, n].sort((a, b) => a - b));

  const addCustom = () => {
    const n = Number(custom);
    if (Number.isInteger(n) && n >= 0 && n <= MAX_OFFSET_DAYS && !offsets.includes(n) && !full) {
      onChange([...offsets, n].sort((a, b) => a - b));
      setCustom("");
    }
  };

  // a nem szabványos (egyéni) értékek is látszanak és törölhetők
  const extras = sorted.filter((n) => !(OFFSET_CHOICES as readonly number[]).includes(n));

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium text-text-2">{t("offsets")}</legend>
      <div className="flex flex-wrap gap-2">
        {OFFSET_CHOICES.map((n) => {
          const on = offsets.includes(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(n)}
              className={cn(
                "min-h-11 rounded-full border px-4 text-sm font-medium disabled:opacity-50",
                on ? "border-primary bg-primary-soft text-primary-text" : "border-border bg-surface text-text-2 hover:bg-surface-2",
              )}
            >
              {label(n)}
            </button>
          );
        })}
        {extras.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed
            onClick={() => toggle(n)}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-primary bg-primary-soft px-4 text-sm font-medium text-primary-text"
          >
            {label(n)}
            <X className="size-3.5" aria-hidden />
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-text-2">
          {t("offsetCustom")}
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_OFFSET_DAYS}
            value={custom}
            disabled={full}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
            className="min-h-11 w-28 rounded-control border border-border bg-surface-2 px-3 text-text"
          />
        </label>
        <button
          type="button"
          onClick={addCustom}
          disabled={full || custom === ""}
          className="min-h-11 rounded-control border border-border bg-surface px-4 text-sm font-medium hover:bg-surface-2 disabled:opacity-50"
        >
          {t("offsetAdd")}
        </button>
      </div>
      {full && <p className="text-sm text-text-2">{t("offsetsFull", { max: MAX_OFFSETS })}</p>}
      {error && (
        <p role="alert" className="text-sm text-danger-text">
          {error}
        </p>
      )}
      {/* a kiválasztott időpontok az űrlappal együtt mennek el */}
      {offsets.map((n) => (
        <input key={n} type="hidden" name="offset" value={n} />
      ))}
    </fieldset>
  );
}

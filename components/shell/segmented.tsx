"use client";

import { cn } from "@/lib/utils";

export type SegmentedOption<T extends string> = { value: T; label: string };

// Közös szegmentált kapcsoló a téma- és nyelvváltóhoz. aria-pressed: a szín mellett szöveg is jelzi az állapotot.
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: SegmentedOption<T>[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="inline-flex rounded-control border border-border bg-surface-2 p-1"
    >
      {options.map((o) => {
        const pressed = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-11 rounded-[10px] px-4 text-sm font-medium transition-colors disabled:opacity-60",
              pressed ? "bg-surface text-primary shadow-card" : "text-text-2 hover:text-text",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

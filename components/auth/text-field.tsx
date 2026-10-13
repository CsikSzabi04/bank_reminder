"use client";

import { AlertCircle } from "lucide-react";
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFieldErrorText } from "./use-field-error";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "className"> & {
  label: string;
  errors?: string[];
  adornment?: ReactNode;
};

// Címke + beviteli mező + hiba a mező alatt (aria-describedby, aria-invalid)
export function TextField({ label, errors, adornment, ...input }: Props) {
  const id = useId();
  const errorId = `${id}-error`;
  const errorText = useFieldErrorText();
  const invalid = Boolean(errors?.length);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text-2">
        {label}
      </label>
      <div className="relative">
        <input
          {...input}
          id={id}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? errorId : undefined}
          className={cn(
            "min-h-12 w-full rounded-control border border-border bg-surface-2 px-4 text-text placeholder:text-text-muted",
            "aria-invalid:border-danger",
            adornment ? "pr-12" : undefined,
          )}
        />
        {adornment && <div className="absolute inset-y-0 right-1 flex items-center">{adornment}</div>}
      </div>
      {invalid && (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-danger-text">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {errorText(errors?.[0])}
        </p>
      )}
    </div>
  );
}

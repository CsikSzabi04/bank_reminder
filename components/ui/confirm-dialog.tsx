"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { BottomSheet } from "./bottom-sheet";

// Megerősítés destruktív/visszafordíthatatlan műveletek előtt. A gomb a művelet futása alatt letiltva.
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  destructive = false,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useTranslations("common");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  return (
    <BottomSheet open={open} onClose={onClose} title={title} description={description}>
      {error && (
        <p role="alert" className="mb-3 text-sm text-danger-text">
          {t("error.generic")}
        </p>
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onClose}
          className="min-h-12 rounded-control border border-border bg-surface px-5 font-medium hover:bg-surface-2"
        >
          {t("cancel")}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(false);
              try {
                await onConfirm();
                onClose();
              } catch {
                setError(true);
              }
            })
          }
          className={cn(
            "min-h-12 rounded-control px-5 font-medium disabled:opacity-70",
            destructive ? "bg-danger text-white" : "bg-primary text-primary-fg",
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

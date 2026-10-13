"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, type ReactNode } from "react";

// Modális lap: mobilon alulról felcsúszó, md-től középre igazított. Natív <dialog>: fókuszcsapda,
// Esc-zárás és fókusz-visszaadás beépítve (§14.14). A `open` prop a forrás-igazság.
export function BottomSheet({
  open,
  onClose,
  title,
  description,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  const t = useTranslations("common");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={onClose}
      // a háttérre (a <dialog> saját területére) kattintva zár; a tartalom belső div-ben van
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      className="m-0 mt-auto w-full max-w-none rounded-t-sheet border border-border bg-surface p-0 text-text backdrop:bg-black/40 md:m-auto md:max-w-md md:rounded-card"
    >
      <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="mb-3 flex items-start justify-between gap-3">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label={t("close")}
            className="-mr-2 -mt-2 flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>
        {description && (
          <p id={descriptionId} className="mb-4 text-text-2">
            {description}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}

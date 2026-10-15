"use client";

import { Check, Copy } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";

// Csak olvasható, másolható érték (webhook-cím, JSON-sablon, token). A másolás eredményét az aria-live régió felolvassa;
// ha a vágólap nem elérhető (nem biztonságos környezet), a felhasználó kijelölheti kézzel.
export function CopyField({ label, value, multiline = false }: { label: string; value: string; multiline?: boolean }) {
  const t = useTranslations("bank.android");
  const labelId = useId();
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setState("copied");
    } catch {
      setState("failed");
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 3000);
  };

  return (
    <div className="flex flex-col gap-1">
      <span id={labelId} className="text-sm font-medium">
        {label}
      </span>
      <div className="flex items-stretch gap-2">
        {multiline ? (
          <pre aria-labelledby={labelId} tabIndex={0} className="min-w-0 flex-1 overflow-x-auto rounded-control border border-border bg-surface-2 p-3 text-sm">
            {value}
          </pre>
        ) : (
          <input
            readOnly
            aria-labelledby={labelId}
            value={value}
            onFocus={(e) => e.currentTarget.select()}
            className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-surface-2 px-3 text-sm"
          />
        )}
        <button
          type="button"
          onClick={copy}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-control border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-2"
        >
          {state === "copied" ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {t("copy")}
        </button>
      </div>
      <p aria-live="polite" className={state === "failed" ? "text-sm text-danger-text" : "text-sm text-text-2"}>
        {state === "copied" ? t("copied") : state === "failed" ? t("copyFailed") : ""}
      </p>
    </div>
  );
}

"use client";

import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type ToastInput = {
  message: string;
  tone?: "success" | "error";
  action?: { label: string; onClick: () => void };
};
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<{ show: (toast: ToastInput) => void } | null>(null);

const MAX_VISIBLE = 3;
const DURATION_MS = 5000;
const ACTION_DURATION_MS = 8000; // visszavonásra hagyjunk időt

// Saját toast (sonner helyett): a sonner futásidőben <style>-t injektál, ami a nonce-os CSP-vel ütközne (§9.6).
// A régió aria-live="polite": a képernyőolvasó felolvassa a visszajelzést.
export function ToastProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("common");
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((current) => current.filter((i) => i.id !== id));
  }, []);

  const show = useCallback(
    (toast: ToastInput) => {
      const id = ++nextId.current;
      setItems((current) => [...current.slice(-(MAX_VISIBLE - 1)), { ...toast, id }]);
      timers.current.set(id, setTimeout(() => dismiss(id), toast.action ? ACTION_DURATION_MS : DURATION_MS));
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((item) => {
          const Icon = item.tone === "error" ? AlertCircle : CheckCircle2;
          return (
            <div
              key={item.id}
              role={item.tone === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-control border border-border bg-surface px-4 py-3 text-sm shadow-card"
            >
              <Icon
                aria-hidden
                className={item.tone === "error" ? "size-5 shrink-0 text-danger-text" : "size-5 shrink-0 text-success-text"}
              />
              <span className="flex-1">{item.message}</span>
              {item.action && (
                <button
                  type="button"
                  onClick={() => {
                    item.action?.onClick();
                    dismiss(item.id);
                  }}
                  className="min-h-11 shrink-0 rounded-control px-3 font-semibold text-primary-text hover:bg-surface-2"
                >
                  {item.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label={t("close")}
                className="flex size-11 shrink-0 items-center justify-center rounded-control text-text-2 hover:bg-surface-2"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast: hiányzik a ToastProvider");
  return ctx;
}

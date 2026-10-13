import { AlertCircle, CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Szín + ikon + szöveg: az állapotot nem csak a szín hordozza (§14.1)
export function Notice({ variant, children }: { variant: "error" | "success"; children: ReactNode }) {
  const Icon = variant === "error" ? AlertCircle : CheckCircle2;
  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-control border px-3 py-2.5 text-sm",
        variant === "error"
          ? "border-danger/40 bg-surface-2 text-danger-text"
          : "border-success/40 bg-surface-2 text-success-text",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}

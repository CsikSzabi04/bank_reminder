import { CircleAlert, CircleCheck, CircleX } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type DiagState = "ok" | "fail" | "warn";
export type DiagRow = { key: string; label: string; state: DiagState; text: string };

const ICON = { ok: CircleCheck, fail: CircleX, warn: CircleAlert } as const;
const TONE = { ok: "text-success-text", fail: "text-danger-text", warn: "text-warning-text" } as const;

// Állapot-diagnosztika (§12.10): minden sor ikon ÉS szöveg (a szín nem hordoz egyedül jelentést)
export function PushDiagnostics({ rows }: { rows: DiagRow[] }) {
  const t = useTranslations("notifications.push.diag");
  return (
    <section aria-labelledby="diag-title" className="flex flex-col gap-2">
      <h3 id="diag-title" className="text-sm font-semibold">
        {t("title")}
      </h3>
      <ul className="divide-y divide-border rounded-control border border-border bg-surface-2 text-sm">
        {rows.map((r) => {
          const Icon = ICON[r.state];
          return (
            <li key={r.key} className="flex items-center gap-2 px-3 py-2">
              <Icon className={cn("size-4 shrink-0", TONE[r.state])} aria-hidden />
              <span className="flex-1">{r.label}</span>
              <span className={cn("text-right font-medium", TONE[r.state])}>
                <span className="sr-only">{t(r.state)}: </span>
                {r.text}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

import type { ReactNode } from "react";

// Egy diagram-kártya: cím + (opcionális) magyarázó sor; a tartalom a diagram vagy a táblázat-nézet
export function ChartCard({ id, title, hint, className = "", children }: { id: string; title: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`flex min-w-0 flex-col gap-3 rounded-card border border-border bg-surface p-5 shadow-card ${className}`}>
      <div>
        <h2 id={id} className="text-lg font-semibold">
          {title}
        </h2>
        {hint && <p className="text-sm text-text-2">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

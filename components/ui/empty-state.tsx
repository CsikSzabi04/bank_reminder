import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// Tanító üres állapot: ikon + 1 mondat + 1 gomb (§14.1/5)
export function EmptyState({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border bg-surface px-6 py-12 text-center">
      <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-primary-soft text-primary-text">
        <Icon className="size-7" />
      </span>
      <h2 className="text-lg font-semibold">{title}</h2>
      {body && <p className="max-w-sm text-text-2">{body}</p>}
      {children && <div className="mt-2 flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Betöltés-jelző a kártyák alakjában (nincs elugró elrendezés). A mozgást a prefers-reduced-motion kikapcsolja.
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-control bg-surface-2", className)} />;
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 p-4" aria-hidden>
      <Skeleton className="size-10" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  const t = useTranslations("common");
  return (
    <div className="divide-y divide-border rounded-card border border-border bg-surface shadow-card" role="status">
      <span className="sr-only">{t("loading")}</span>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

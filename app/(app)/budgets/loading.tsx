import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

export default function BudgetsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-36 w-full rounded-card" />
      <SkeletonCard rows={3} />
    </div>
  );
}

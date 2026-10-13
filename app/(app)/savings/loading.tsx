import { Skeleton } from "@/components/ui/skeleton";

export default function SavingsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-40 w-full rounded-card" />
      <Skeleton className="h-40 w-full rounded-card" />
    </div>
  );
}

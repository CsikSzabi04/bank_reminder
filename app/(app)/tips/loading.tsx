import { Skeleton } from "@/components/ui/skeleton";

export default function TipsLoading() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5" aria-busy="true">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-36 w-full rounded-card" />
      <Skeleton className="h-36 w-full rounded-card" />
    </div>
  );
}

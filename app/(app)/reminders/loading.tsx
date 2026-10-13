import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

// A lista alakját követő váz (nincs elugró elrendezés, §14.12)
export default function RemindersLoading() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-12 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-11 w-20 rounded-full" />
        <Skeleton className="h-11 w-24 rounded-full" />
        <Skeleton className="h-11 w-28 rounded-full" />
      </div>
      <SkeletonCard rows={4} />
    </div>
  );
}

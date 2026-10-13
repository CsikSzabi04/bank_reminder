import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";

// A dashboard alakját követő váz (nincs elugró elrendezés, §14.12)
export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <Skeleton className="h-80 w-full rounded-card" />
          <SkeletonCard rows={3} />
        </div>
        <div className="flex flex-col gap-5 lg:col-span-4">
          <Skeleton className="h-44 w-full rounded-card" />
          <Skeleton className="h-40 w-full rounded-card" />
        </div>
      </div>
    </div>
  );
}

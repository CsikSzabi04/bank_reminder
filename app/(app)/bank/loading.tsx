import { Skeleton } from "@/components/ui/skeleton";

export default function BankLoading() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <div className="md:grid md:grid-cols-[220px_1fr] md:items-start md:gap-8">
        <div className="flex flex-col gap-1">
          <Skeleton className="h-12 w-full rounded-control" />
          <Skeleton className="h-12 w-full rounded-control" />
          <Skeleton className="h-12 w-full rounded-control" />
        </div>
        <Skeleton className="hidden h-48 w-full rounded-card md:block" />
      </div>
    </div>
  );
}

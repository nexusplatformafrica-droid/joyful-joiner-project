import { Skeleton } from "@/components/ui/skeleton";

export function CardSkeleton({ block = false }: { block?: boolean }) {
  return (
    <div className={block ? "w-full" : "w-[150px] shrink-0 sm:w-[176px]"}>
      <Skeleton className="aspect-[2/3] w-full rounded-xl" />
      <Skeleton className="mt-2 h-3.5 w-4/5 rounded" />
      <Skeleton className="mt-1.5 h-3 w-2/5 rounded" />
    </div>
  );
}

export function RowSkeleton({ count = 7, heading = true }: { count?: number; heading?: boolean }) {
  return (
    <section className="mt-8">
      {heading && <Skeleton className="mb-3 h-6 w-40 rounded" />}
      <div className="scrollbar-none flex gap-3 overflow-hidden pb-1 pr-5">
        {Array.from({ length: count }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    </section>
  );
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-3 gap-x-2 gap-y-4 sm:gap-x-3 sm:gap-y-5 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} block />
      ))}
    </div>
  );
}

export function WatchSkeleton() {
  return (
    <div className="flex flex-col gap-6 lg:flex-row">
      <div className="min-w-0 flex-1">
        <Skeleton className="aspect-video w-full rounded-[1.25rem]" />
        <Skeleton className="mt-4 h-6 w-2/3 rounded" />
        <div className="mt-3 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-24 rounded-full" />
          ))}
        </div>
        <div className="mt-5 flex gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <Skeleton className="size-14 rounded-full" />
              <Skeleton className="h-3 w-12 rounded" />
            </div>
          ))}
        </div>
        <RowSkeleton count={6} />
      </div>
      <aside className="w-full shrink-0 lg:w-[320px]">
        <Skeleton className="h-5 w-28 rounded" />
        <div className="mt-3 grid grid-cols-5 gap-2">
          {Array.from({ length: 20 }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded" />
          ))}
        </div>
      </aside>
    </div>
  );
}

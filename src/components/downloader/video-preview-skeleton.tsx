import { Skeleton } from "@/components/ui/skeleton";

export function VideoPreviewSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">{label}</span>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Skeleton className="aspect-video w-full rounded-2xl sm:w-60" />
        <div className="flex-1 space-y-3 pt-1">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-6 w-11/12" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[84px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}

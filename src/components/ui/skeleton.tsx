import { cn } from "@/lib/utils";

/** Base shimmering placeholder block. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/70", className)} />;
}

/** Skeleton rows for a table body while data loads. */
export function TableSkeleton({ columns, rows = 6 }: { columns: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-t border-slate-100">
          {Array.from({ length: columns }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className={cn("h-4", c === 0 ? "w-40" : "w-20")} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** Skeleton for a KPI / stat card. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <Skeleton className="h-11 w-11 rounded-xl" />
      <Skeleton className="mt-4 h-3 w-24" />
      <Skeleton className="mt-2 h-6 w-28" />
    </div>
  );
}

/** Generic card skeleton (header + lines). */
export function CardSkeleton({ lines = 4 }: { lines?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5">
      <Skeleton className="h-4 w-32" />
      <div className="mt-4 space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-3.5 w-full" />
        ))}
      </div>
    </div>
  );
}

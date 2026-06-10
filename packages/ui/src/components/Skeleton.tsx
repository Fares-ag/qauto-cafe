'use client';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-shimmer-bg rounded-lg ${className}`} />;
}

export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-soft">
      <Skeleton className="mb-3 h-3 w-20" />
      <Skeleton className="mb-2 h-8 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

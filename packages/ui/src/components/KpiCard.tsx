'use client';

export function KpiCard({
  label,
  value,
  subtext,
  trend,
}: {
  label: string;
  value: string;
  subtext?: string;
  trend?: { value: string; positive?: boolean };
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-raised p-5 shadow-soft transition-shadow duration-150 hover:shadow-card">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <div className="mt-2 flex items-center gap-2">
        {subtext ? <p className="text-xs text-ink-muted">{subtext}</p> : null}
        {trend ? (
          <span
            className={`text-xs font-medium ${trend.positive ? 'text-success' : 'text-danger'}`}
          >
            {trend.value}
          </span>
        ) : null}
      </div>
    </div>
  );
}

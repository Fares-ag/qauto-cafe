import { Suspense } from 'react';
import ReportsCenter from './ReportsCenter';

export default function ReportsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-7xl p-8 text-sm text-ink-muted">Loading report center…</div>
      }
    >
      <ReportsCenter />
    </Suspense>
  );
}

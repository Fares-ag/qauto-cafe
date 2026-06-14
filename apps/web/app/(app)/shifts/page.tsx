'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Shift, ShiftSummary } from '@qauto/shared-types';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  KpiCard,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function ShiftsPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [closeCash, setCloseCash] = useState('');
  const [closing, setClosing] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const data = await client.listShifts(branchId, 30);
      setShifts(data);
      if (!selectedId && data[0]) setSelectedId(data[0].id);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load shifts', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setSummary(null);
      return;
    }
    setSummaryLoading(true);
    getApiClient()
      .getShiftSummary(selectedId)
      .then(setSummary)
      .catch((err) =>
        toast(err instanceof Error ? err.message : 'Failed to load summary', 'error'),
      )
      .finally(() => setSummaryLoading(false));
  }, [selectedId, toast]);

  async function handleCloseShift() {
    if (!selectedId) return;
    setClosing(true);
    try {
      await getApiClient().closeShift(selectedId, {
        actualCash: closeCash || '0.0000',
      });
      toast('Shift closed', 'success');
      setCloseCash('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to close shift', 'error');
    } finally {
      setClosing(false);
    }
  }

  const selected = shifts.find((s) => s.id === selectedId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Shifts</h1>
        <p className="mt-1 text-sm text-ink-muted">Reconciliation, cash variance, and sales summary</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card padding="lg" className="lg:col-span-1">
          <CardHeader title="Recent shifts" />
          {loading ? (
            <TableSkeleton rows={6} />
          ) : shifts.length === 0 ? (
            <EmptyState title="No shifts" description="Open a shift from the Sell page" />
          ) : (
            <ul className="space-y-1">
              {shifts.map((shift) => (
                <li key={shift.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(shift.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      selectedId === shift.id
                        ? 'bg-brand-muted text-brand'
                        : 'hover:bg-surface-sunken'
                    }`}
                  >
                    <span className="font-medium">
                      {new Date(shift.openedAt).toLocaleString()}
                    </span>
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                        shift.status === 'OPEN'
                          ? 'bg-success/10 text-success'
                          : 'bg-surface-sunken text-ink-muted'
                      }`}
                    >
                      {shift.status}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6 lg:col-span-2">
          {summaryLoading ? (
            <TableSkeleton rows={4} />
          ) : summary ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="Orders" value={String(summary.orderCount)} />
                <KpiCard label="Gross sales" value={`${summary.grossSales} QAR`} />
                <KpiCard label="Cash" value={`${summary.cashSales} QAR`} />
                <KpiCard label="Card" value={`${summary.cardSales} QAR`} />
              </div>

              <Card padding="lg">
                <CardHeader title="Cash reconciliation" />
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-ink-muted">Opening float</dt>
                    <dd className="font-medium text-ink">{summary.shift.openingFloat} QAR</dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Expected cash</dt>
                    <dd className="font-medium text-ink">
                      {summary.shift.expectedCash ?? '—'} QAR
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Actual cash</dt>
                    <dd className="font-medium text-ink">
                      {summary.shift.actualCash ?? '—'} QAR
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Variance</dt>
                    <dd
                      className={`font-medium ${
                        summary.shift.cashVariance &&
                        parseFloat(summary.shift.cashVariance) !== 0
                          ? 'text-danger'
                          : 'text-ink'
                      }`}
                    >
                      {summary.shift.cashVariance ?? '—'} QAR
                    </dd>
                  </div>
                  <div>
                    <dt className="text-ink-muted">Voids</dt>
                    <dd className="font-medium text-ink">{summary.voidCount}</dd>
                  </div>
                </dl>
              </Card>

              {summary.shift.cashEvents?.length ? (
                <Card padding="lg">
                  <CardHeader title="Cash events" />
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-ink-muted">
                          <th className="pb-2 pr-4 font-medium">Type</th>
                          <th className="pb-2 pr-4 font-medium">Amount</th>
                          <th className="pb-2 font-medium">Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.shift.cashEvents.map((event) => (
                          <tr key={event.id} className="border-b border-border/60">
                            <td className="py-2 pr-4">{event.type}</td>
                            <td className="py-2 pr-4">{event.amount} QAR</td>
                            <td className="py-2 text-ink-secondary">
                              {new Date(event.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              ) : null}
            </>
          ) : (
            <EmptyState title="Select a shift" description="Choose a shift to view reconciliation" />
          )}

          {selected?.status === 'OPEN' ? (
            <Card padding="lg">
              <CardHeader title="Close open shift" />
              <div className="flex flex-wrap items-end gap-3">
                <Input
                  label="Actual cash count (QAR)"
                  value={closeCash}
                  onChange={(e) => setCloseCash(e.target.value)}
                  className="min-w-[12rem] flex-1"
                />
                <Button variant="primary" loading={closing} onClick={handleCloseShift}>
                  Close shift
                </Button>
              </div>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

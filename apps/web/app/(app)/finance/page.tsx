'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CorporateBillingReport,
  DepartmentStatementReport,
  PnlAnalyticsReport,
} from '@qauto/shared-types';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  KpiCard,
  KpiCardSkeleton,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { getApiClient, formatQar } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type Tab = 'revenue' | 'corporate' | 'statements';

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function FinancePage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>('revenue');
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(todayIso());
  const [pnl, setPnl] = useState<PnlAnalyticsReport | null>(null);
  const [corporate, setCorporate] = useState<CorporateBillingReport | null>(null);
  const [departments, setDepartments] = useState<string[]>([]);
  const [statementDept, setStatementDept] = useState('');
  const [statementMonth, setStatementMonth] = useState(currentMonth());
  const [statement, setStatement] = useState<DepartmentStatementReport | null>(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  const loadRevenue = useCallback(async () => {
    if (!branchId) return;
    const client = getApiClient();
    setPnl(await client.getPnlAnalytics(branchId, fromDate, toDate));
  }, [branchId, fromDate, toDate]);

  const loadCorporate = useCallback(async () => {
    if (!branchId) return;
    const client = getApiClient();
    setCorporate(await client.getCorporateBillingReport(branchId, fromDate, toDate));
  }, [branchId, fromDate, toDate]);

  const loadDepartments = useCallback(async () => {
    if (!branchId) return [];
    const client = getApiClient();
    return client.getBillingDepartments(branchId);
  }, [branchId]);

  const loadStatement = useCallback(async () => {
    if (!branchId || !statementDept) return;
    const client = getApiClient();
    setStatement(await client.getDepartmentStatement(branchId, statementDept, statementMonth));
  }, [branchId, statementDept, statementMonth]);

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    const run = async () => {
      try {
        if (tab === 'revenue') {
          await loadRevenue();
        } else if (tab === 'corporate') {
          await loadCorporate();
        } else {
          const list = await loadDepartments();
          setDepartments(list);
          if (list.length > 0 && !list.includes(statementDept)) {
            setStatementDept(list[0]);
          } else if (statementDept) {
            await loadStatement();
          }
        }
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to load finance data', 'error');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [branchId, tab, fromDate, toDate, statementDept, statementMonth, loadRevenue, loadCorporate, loadDepartments, loadStatement, toast]);

  async function exportCsv() {
    if (!branchId || !statementDept) return;
    try {
      const csv = await getApiClient().downloadDepartmentStatementCsv(
        branchId,
        statementDept,
        statementMonth,
      );
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `statement-${statementDept.replace(/\s+/g, '-')}-${statementMonth}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  }

  function printStatement() {
    window.print();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'revenue', label: 'Revenue & margin' },
    { id: 'corporate', label: 'Corporate billing' },
    { id: 'statements', label: 'Dept statements' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 print:max-w-none">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Finance</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Live P&L and corporate analytics ·{' '}
            <a href="/reports" className="font-medium text-brand hover:underline">
              Generate printable reports →
            </a>
          </p>
        </div>
        {tab !== 'statements' ? (
          <div className="flex flex-wrap gap-3">
            <Input label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <Input label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-ink">Department</span>
              <select
                className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                value={statementDept}
                onChange={(e) => setStatementDept(e.target.value)}
              >
                {departments.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
            <Input
              label="Month"
              type="month"
              value={statementMonth}
              onChange={(e) => setStatementMonth(e.target.value)}
            />
            <Button variant="secondary" onClick={() => loadStatement()}>Refresh</Button>
            <Button variant="secondary" onClick={exportCsv} disabled={!statement}>Export CSV</Button>
            <Button onClick={printStatement} disabled={!statement}>Print / PDF</Button>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-border bg-surface-raised p-0.5 print:hidden">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === id ? 'bg-brand text-brand-foreground' : 'text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <KpiCardSkeleton key={i} />
            ))}
          </div>
          <TableSkeleton rows={6} />
        </div>
      ) : null}

      {!loading && tab === 'revenue' && pnl ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Net sales" value={formatQar(pnl.summary.netSales)} />
            <KpiCard label="Gross margin" value={`${pnl.summary.marginPct}%`} />
            <KpiCard label="Avg ticket" value={formatQar(pnl.summary.avgTicket)} />
            <KpiCard label="Items / order" value={pnl.summary.avgItemsPerOrder} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="lg">
              <CardHeader title="P&L summary" />
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-ink-muted">Gross sales</dt>
                <dd className="text-right font-medium">{formatQar(pnl.summary.grossSales)}</dd>
                <dt className="text-ink-muted">Discounts</dt>
                <dd className="text-right text-danger">−{formatQar(pnl.summary.discountTotal)}</dd>
                <dt className="text-ink-muted">Refunds</dt>
                <dd className="text-right text-danger">−{formatQar(pnl.summary.refundTotal)}</dd>
                <dt className="text-ink-muted">Voids</dt>
                <dd className="text-right">{pnl.summary.voidCount}</dd>
                <dt className="text-ink-muted">COGS</dt>
                <dd className="text-right">−{formatQar(pnl.summary.cogsTotal)}</dd>
                <dt className="text-ink-muted font-semibold text-ink">Contribution</dt>
                <dd className="text-right font-semibold text-brand">{formatQar(pnl.summary.contributionMargin)}</dd>
              </dl>
            </Card>

            <Card padding="lg">
              <CardHeader title="Payment mix" />
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-ink-muted">Cash</span><span>{formatQar(pnl.paymentTenders.cash)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Card</span><span>{formatQar(pnl.paymentTenders.card)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Corporate tender</span><span>{formatQar(pnl.paymentTenders.corporate)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Deferred outstanding</span><span className="text-warning">{formatQar(pnl.paymentTenders.deferredOutstanding)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Deferred created (period)</span><span>{formatQar(pnl.paymentTenders.deferredCreatedInPeriod)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Deferred collected (period)</span><span>{formatQar(pnl.paymentTenders.deferredCollectedInPeriod)}</span></div>
              </dl>
            </Card>
          </div>

          <Card padding="lg">
            <CardHeader title="Margin by category" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 pr-4 text-right">Sales</th>
                    <th className="py-2 pr-4 text-right">COGS</th>
                    <th className="py-2 pr-4 text-right">Margin</th>
                    <th className="py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.marginByCategory.map((r) => (
                    <tr key={r.category} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{r.category}</td>
                      <td className="py-2 pr-4 text-right">{r.quantitySold}</td>
                      <td className="py-2 pr-4 text-right">{formatQar(r.grossSales)}</td>
                      <td className="py-2 pr-4 text-right">{formatQar(r.cogsTotal)}</td>
                      <td className="py-2 pr-4 text-right">{formatQar(r.margin)}</td>
                      <td className="py-2 text-right">{r.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card padding="lg">
            <CardHeader title="Margin by product (SKU)" description="Volume vs margin — watch low-margin bestsellers" />
            <div className="max-h-96 overflow-y-auto overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-raised">
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="py-2 pr-4">Product</th>
                    <th className="py-2 pr-4">Category</th>
                    <th className="py-2 pr-4 text-right">Qty</th>
                    <th className="py-2 pr-4 text-right">Sales</th>
                    <th className="py-2 pr-4 text-right">Margin</th>
                    <th className="py-2 text-right">%</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.marginBySku.map((r) => (
                    <tr key={r.menuItemId} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{r.menuItemName}</td>
                      <td className="py-2 pr-4 text-ink-muted">{r.category}</td>
                      <td className="py-2 pr-4 text-right">{r.quantitySold}</td>
                      <td className="py-2 pr-4 text-right">{formatQar(r.grossSales)}</td>
                      <td className="py-2 pr-4 text-right">{formatQar(r.margin)}</td>
                      <td className={`py-2 text-right ${parseFloat(r.marginPct) < 30 ? 'text-danger' : ''}`}>{r.marginPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {!loading && tab === 'corporate' && corporate ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Collection rate" value={`${corporate.collections.collectionRatePct}%`} />
            <KpiCard label="Office guests" value={String(corporate.guestVsStaff.officeGuestOrders)} />
            <KpiCard label="Staff orders" value={String(corporate.guestVsStaff.namedStaffOrders)} />
            <KpiCard label="Guest ratio" value={`${corporate.guestVsStaff.guestRatioPct}%`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card padding="lg">
              <CardHeader title="Sales by billing party" />
              <table className="w-full text-sm">
                <tbody>
                  {corporate.byBillingParty.map((r) => (
                    <tr key={r.party} className="border-b border-border/60">
                      <td className="py-2">{r.party}</td>
                      <td className="py-2 text-right text-ink-muted">{r.orderCount} orders</td>
                      <td className="py-2 text-right font-medium">{formatQar(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card padding="lg">
              <CardHeader title="Pay-later aging (unpaid)" />
              <table className="w-full text-sm">
                <tbody>
                  {corporate.payLaterAging.map((r) => (
                    <tr key={r.bucket} className="border-b border-border/60">
                      <td className="py-2">{r.bucket}</td>
                      <td className="py-2 text-right text-ink-muted">{r.count}</td>
                      <td className="py-2 text-right font-medium">{formatQar(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-ink-muted">
                Write-offs: {formatQar(corporate.collections.writeOffTotal)} · Refunds:{' '}
                {formatQar(corporate.collections.refundTotal)}
              </p>
            </Card>
          </div>

          <Card padding="lg">
            <CardHeader title="Top departments by spend" />
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="py-2">Department</th>
                  <th className="py-2 text-right">Orders</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {corporate.topDepartments.map((r) => (
                  <tr key={r.department} className="border-b border-border/60">
                    <td className="py-2 font-medium">{r.department}</td>
                    <td className="py-2 text-right">{r.orderCount}</td>
                    <td className="py-2 text-right">{formatQar(r.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card padding="lg">
            <CardHeader title="Top staff by spend" />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-ink-muted">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Dept</th>
                    <th className="py-2 pr-4">Ext.</th>
                    <th className="py-2 pr-4 text-right">Orders</th>
                    <th className="py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {corporate.topStaff.map((r) => (
                    <tr key={r.customerId ?? r.name} className="border-b border-border/60">
                      <td className="py-2 pr-4 font-medium">{r.name}</td>
                      <td className="py-2 pr-4 text-ink-muted">{r.department ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono text-xs">{r.phoneExtension ?? '—'}</td>
                      <td className="py-2 pr-4 text-right">{r.orderCount}</td>
                      <td className="py-2 text-right">{formatQar(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {!loading && tab === 'statements' ? (
        statement ? (
          <div ref={printRef} className="statement-print space-y-4">
            <div className="hidden print:block">
              <h1 className="text-xl font-bold">QAuto Café — Department Statement</h1>
              <p className="text-sm">{statement.branchName} · {statement.periodLabel}</p>
            </div>
            <Card padding="lg" className="print:border-0 print:shadow-none">
              <CardHeader
                title={`${statement.department} — ${statement.periodLabel}`}
                description={`${statement.orderCount} orders · Chargeback total ${formatQar(statement.total)}`}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-muted">
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">Date</th>
                      <th className="py-2 pr-3">Guest / staff</th>
                      <th className="py-2 pr-3">Items</th>
                      <th className="py-2 pr-3 text-right">Total</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statement.lines.map((l) => (
                      <tr key={l.orderId} className="border-b border-border/60">
                        <td className="py-2 pr-3 font-mono">{l.orderNumber}</td>
                        <td className="py-2 pr-3">{l.businessDate}</td>
                        <td className="py-2 pr-3">{l.guestName ?? l.staffName ?? '—'}</td>
                        <td className="py-2 pr-3 max-w-xs truncate">{l.lineSummary}</td>
                        <td className="py-2 pr-3 text-right font-medium">{formatQar(l.total)}</td>
                        <td className="py-2 text-xs text-ink-muted">{l.status}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td colSpan={4} className="py-3 text-right">Total chargeback</td>
                      <td className="py-3 text-right text-brand">{formatQar(statement.total)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        ) : (
          <EmptyState title="No statement data" description="Select a department with department-billed orders for this month." />
        )
      ) : null}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .statement-print, .statement-print * { visibility: visible; }
          .statement-print { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}

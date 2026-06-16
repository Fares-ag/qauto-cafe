'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DashboardAnalytics, ProductSalesReportRow, QueueOrder } from '@qauto/shared-types';
import type { InventoryStockItem } from '@qauto/api-client';
import {
  Alert,
  Badge,
  Card,
  CardHeader,
  EmptyState,
  Input,
  KpiCard,
  KpiCardSkeleton,
  StatusBadge,
  TableSkeleton,
} from '@qauto/ui';
import { getApiClient, getBusinessDate, formatQar } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { DashboardChartsLazy } from '@/components/DashboardChartsLazy';

export default function DashboardPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const [businessDate, setBusinessDate] = useState(getBusinessDate());
  const [analytics, setAnalytics] = useState<DashboardAnalytics | null>(null);
  const [products, setProducts] = useState<ProductSalesReportRow[]>([]);
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [stock, setStock] = useState<InventoryStockItem[]>([]);
  const [unpaidCount, setUnpaidCount] = useState(0);
  const [outstandingTotal, setOutstandingTotal] = useState('0.0000');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      const [dashboardData, productData, queueData, lowStockData, unpaidData] = await Promise.all([
        client.getDashboardAnalytics(branchId, businessDate, 7),
        client.getProductPerformance(branchId, businessDate),
        client.getOrderQueue(branchId),
        client.getLowStock(branchId),
        client.getUnpaidOrdersReport(branchId),
      ]);
      setAnalytics(dashboardData);
      setProducts(productData);
      setQueue(queueData);
      setStock(
        lowStockData.items.map((i) => ({
          ingredientId: i.ingredientId,
          name: i.name,
          code: i.code,
          isPackaging: false,
          available: i.available,
          uom: i.uom,
        })),
      );
      setUnpaidCount(unpaidData.orderCount);
      setOutstandingTotal(unpaidData.outstandingTotal);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [branchId, businessDate]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [load]);

  const kpis = analytics?.kpis;
  const queueBreakdown = useMemo(
    () => ({
      pending: queue.filter((o) => o.status === 'PENDING_PAYMENT').length,
      paid: queue.filter((o) => o.status === 'PAID').length,
      inPrep: queue.filter((o) => o.status === 'IN_PREP').length,
      ready: queue.filter((o) => o.status === 'READY').length,
    }),
    [queue],
  );

  const lowStock = useMemo(() => stock.slice(0, 6), [stock]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Sales analytics, margins, and live operations
          </p>
        </div>
        <div className="w-full sm:w-48">
          <Input
            label="Business date"
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
          />
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            <KpiCard
              label="Net sales"
              value={formatQar(kpis?.netSales ?? '0')}
              subtext={`${kpis?.orderCount ?? 0} orders · avg ${formatQar(kpis?.avgTicket ?? '0')}`}
            />
            <KpiCard
              label="Gross margin"
              value={`${kpis?.marginPct ?? '0'}%`}
              subtext={`Food cost ${kpis?.foodCostPct ?? '0'}% · COGS ${formatQar(kpis?.cogsTotal ?? '0')}`}
            />
            <KpiCard
              label="Outstanding AR"
              value={formatQar(outstandingTotal)}
              subtext={`${unpaidCount} unpaid · refunds ${formatQar(kpis?.refundTotal ?? '0')}`}
            />
            <KpiCard
              label="Discounts & tax"
              value={formatQar(kpis?.discountTotal ?? '0')}
              subtext={`Tax ${formatQar(kpis?.taxTotal ?? '0')} · voids ${kpis?.voidCount ?? 0}`}
            />
          </>
        )}
      </div>

      <DashboardChartsLazy
        loading={loading}
        businessDate={businessDate}
        analytics={analytics}
        products={products}
        formatQar={formatQar}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Live queue" description="Orders in bar workflow" />
          {loading ? (
            <TableSkeleton rows={3} />
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Unpaid', count: queueBreakdown.pending, variant: 'warning' as const },
                { label: 'Paid', count: queueBreakdown.paid, variant: 'accent' as const },
                { label: 'In prep', count: queueBreakdown.inPrep, variant: 'warning' as const },
                { label: 'Ready', count: queueBreakdown.ready, variant: 'success' as const },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2.5"
                >
                  <span className="text-sm text-ink-secondary">{row.label}</span>
                  <Badge variant={row.variant}>{row.count}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Inventory alerts" description="Below reorder point" />
          {loading ? (
            <TableSkeleton rows={4} />
          ) : lowStock.length === 0 ? (
            <EmptyState title="Stock healthy" description="All ingredients above threshold." />
          ) : (
            <div className="space-y-2">
              {lowStock.map((item) => (
                <div
                  key={item.ingredientId}
                  className="flex items-center justify-between rounded-lg border border-warning/20 bg-warning-muted/50 px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-xs text-ink-muted">{item.code}</p>
                  </div>
                  <Badge variant="warning">
                    {item.available} {item.uom}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader title="Active orders" description="Kitchen queue snapshot" />
          {loading ? (
            <TableSkeleton rows={4} />
          ) : queue.length === 0 ? (
            <EmptyState title="Queue clear" description="No active orders." />
          ) : (
            <div className="space-y-2">
              {queue.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">#{order.orderNumber}</p>
                    <p className="text-xs text-ink-muted">
                      {order.lines.map((l) => l.itemName).join(', ')}
                    </p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

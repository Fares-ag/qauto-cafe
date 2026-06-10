'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DailySalesReport, ProductSalesReportRow, QueueOrder } from '@qauto/shared-types';
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

export default function DashboardPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const [businessDate, setBusinessDate] = useState(getBusinessDate());
  const [sales, setSales] = useState<DailySalesReport | null>(null);
  const [products, setProducts] = useState<ProductSalesReportRow[]>([]);
  const [queue, setQueue] = useState<QueueOrder[]>([]);
  const [stock, setStock] = useState<InventoryStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    setError(null);
    try {
      const client = getApiClient();
      const [salesData, productData, queueData, stockData] = await Promise.all([
        client.getDailySalesReport(branchId, businessDate),
        client.getProductPerformance(branchId, businessDate),
        client.getOrderQueue(branchId),
        client.getInventoryStock(branchId),
      ]);
      setSales(salesData);
      setProducts(productData);
      setQueue(queueData);
      setStock(stockData.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [branchId, businessDate]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const queueBreakdown = useMemo(
    () => ({
      paid: queue.filter((o) => o.status === 'PAID').length,
      inPrep: queue.filter((o) => o.status === 'IN_PREP').length,
      ready: queue.filter((o) => o.status === 'READY').length,
    }),
    [queue],
  );

  const lowStock = useMemo(() => {
    return stock
      .filter((item) => !item.isPackaging)
      .filter((item) => {
        const qty = parseFloat(item.available);
        return qty < 50;
      })
      .slice(0, 6);
  }, [stock]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Today&apos;s performance and live operations
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
              label="Gross sales"
              value={formatQar(sales?.grossSales ?? '0')}
              subtext={`${sales?.orderCount ?? 0} orders`}
            />
            <KpiCard
              label="Net sales"
              value={formatQar(sales?.netSales ?? '0')}
              subtext={`COGS ${formatQar(sales?.cogsTotal ?? '0')}`}
            />
            <KpiCard
              label="Cash / Card"
              value={formatQar(sales?.cashTotal ?? '0')}
              subtext={`Card ${formatQar(sales?.cardTotal ?? '0')}`}
            />
            <KpiCard
              label="Drinks / Snacks"
              value={formatQar(sales?.drinkSales ?? '0')}
              subtext={`Snacks ${formatQar(sales?.snackSales ?? '0')}`}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Live queue" description="Orders in bar workflow" />
          {loading ? (
            <TableSkeleton rows={3} />
          ) : (
            <div className="space-y-3">
              {[
                { label: 'New (paid)', count: queueBreakdown.paid, variant: 'accent' as const },
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
              {queue.length === 0 ? (
                <p className="text-sm text-ink-muted">No active orders in queue</p>
              ) : null}
            </div>
          )}
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Top sellers" description={`Business date ${businessDate}`} />
          {loading ? (
            <TableSkeleton rows={5} />
          ) : products.length === 0 ? (
            <EmptyState
              title="No sales yet"
              description="Paid orders will appear here once the day gets started."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-ink-muted">
                    <th className="pb-2 font-medium">Item</th>
                    <th className="pb-2 font-medium">Qty</th>
                    <th className="pb-2 font-medium">Sales</th>
                    <th className="pb-2 font-medium">COGS</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 8).map((row) => (
                    <tr
                      key={row.menuItemId}
                      className="border-b border-border/60 transition-colors duration-150 last:border-0 hover:bg-surface-sunken/50"
                    >
                      <td className="py-2.5 font-medium text-ink">{row.menuItemName}</td>
                      <td className="py-2.5 text-ink-secondary">{row.quantitySold}</td>
                      <td className="py-2.5 text-ink-secondary">{formatQar(row.grossSales)}</td>
                      <td className="py-2.5 text-ink-muted">{formatQar(row.cogsTotal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Inventory alerts"
            description="Ingredients below threshold"
          />
          {loading ? (
            <TableSkeleton rows={4} />
          ) : lowStock.length === 0 ? (
            <EmptyState
              title="Stock levels healthy"
              description="No ingredients are running low at this branch."
            />
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

        <Card>
          <CardHeader title="Active orders" description="Currently in bar queue" />
          {loading ? (
            <TableSkeleton rows={4} />
          ) : queue.length === 0 ? (
            <EmptyState
              title="Queue is clear"
              description="New paid orders from POS will show up here in real time."
            />
          ) : (
            <div className="space-y-2">
              {queue.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg bg-surface-sunken px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium text-ink">Order #{order.orderNumber}</p>
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

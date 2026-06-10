'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  DailySalesReport,
  IngredientUsageReportRow,
  ProductSalesReportRow,
} from '@qauto/shared-types';
import {
  Card,
  CardHeader,
  EmptyState,
  Input,
  KpiCard,
  KpiCardSkeleton,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { getApiClient, getBusinessDate, formatQar } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

export default function ReportsPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [businessDate, setBusinessDate] = useState(getBusinessDate());
  const [sales, setSales] = useState<DailySalesReport | null>(null);
  const [products, setProducts] = useState<ProductSalesReportRow[]>([]);
  const [ingredients, setIngredients] = useState<IngredientUsageReportRow[]>([]);
  const [employees, setEmployees] = useState<
    Array<{ userName: string; ordersHandled: number; grossSales: string; voidCount: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'products' | 'ingredients' | 'staff'>('products');

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const [salesData, productData, ingredientData, employeeData] = await Promise.all([
        client.getDailySalesReport(branchId, businessDate),
        client.getProductPerformance(branchId, businessDate),
        client.getIngredientUsage(branchId, businessDate),
        client.getEmployeeActivity(branchId, businessDate),
      ]);
      setSales(salesData);
      setProducts(productData);
      setIngredients(ingredientData);
      setEmployees(employeeData as typeof employees);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load reports', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, businessDate, toast]);

  useEffect(() => {
    load();
  }, [load]);

  function exportCsv() {
    const rows =
      tab === 'products'
        ? products.map((p) => [p.menuItemName, p.quantitySold, p.grossSales, p.cogsTotal])
        : tab === 'ingredients'
          ? ingredients.map((i) => [i.ingredientName, i.quantityUsed, i.uomCode, i.valueUsed])
          : employees.map((e) => [e.userName, e.ordersHandled, e.grossSales, e.voidCount]);

    const header =
      tab === 'products'
        ? ['Product', 'Qty', 'Sales', 'COGS']
        : tab === 'ingredients'
          ? ['Ingredient', 'Qty used', 'UOM', 'Value']
          : ['Staff', 'Orders', 'Sales', 'Voids'];

    const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qauto-${tab}-${businessDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('CSV exported', 'success');
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Reports</h1>
          <p className="mt-1 text-sm text-ink-muted">Sales, usage, and staff activity</p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Business date"
            type="date"
            value={businessDate}
            onChange={(e) => setBusinessDate(e.target.value)}
          />
          <button
            type="button"
            onClick={exportCsv}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-ink-secondary hover:bg-surface-sunken"
          >
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <KpiCardSkeleton key={i} />
          ))}
        </div>
      ) : sales ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard label="Net sales" value={formatQar(sales.netSales)} />
          <KpiCard label="Orders" value={String(sales.orderCount)} />
          <KpiCard label="COGS" value={formatQar(sales.cogsTotal)} />
          <KpiCard label="Voids" value={String(sales.voidCount)} />
        </div>
      ) : null}

      <div className="flex gap-2">
        {(['products', 'ingredients', 'staff'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-2 text-sm font-medium capitalize ${
              tab === t
                ? 'bg-brand text-brand-foreground'
                : 'border border-border text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <Card padding="lg">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : tab === 'products' ? (
          products.length === 0 ? (
            <EmptyState title="No product data" description="Pay orders to populate summaries" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Product</th>
                  <th className="pb-3 pr-4 font-medium">Qty</th>
                  <th className="pb-3 pr-4 font-medium">Sales</th>
                  <th className="pb-3 font-medium">COGS</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.menuItemId} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium">{p.menuItemName}</td>
                    <td className="py-3 pr-4">{p.quantitySold}</td>
                    <td className="py-3 pr-4">{formatQar(p.grossSales)}</td>
                    <td className="py-3">{formatQar(p.cogsTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : tab === 'ingredients' ? (
          ingredients.length === 0 ? (
            <EmptyState title="No ingredient usage" />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">Ingredient</th>
                  <th className="pb-3 pr-4 font-medium">Used</th>
                  <th className="pb-3 font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {ingredients.map((i) => (
                  <tr key={i.ingredientId} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium">{i.ingredientName}</td>
                    <td className="py-3 pr-4">
                      {i.quantityUsed} {i.uomCode}
                    </td>
                    <td className="py-3">{formatQar(i.valueUsed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : employees.length === 0 ? (
          <EmptyState title="No staff activity" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-ink-muted">
                <th className="pb-3 pr-4 font-medium">Staff</th>
                <th className="pb-3 pr-4 font-medium">Orders</th>
                <th className="pb-3 pr-4 font-medium">Sales</th>
                <th className="pb-3 font-medium">Voids</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e, idx) => (
                <tr key={idx} className="border-b border-border/60">
                  <td className="py-3 pr-4 font-medium">{e.userName}</td>
                  <td className="py-3 pr-4">{e.ordersHandled}</td>
                  <td className="py-3 pr-4">{formatQar(e.grossSales)}</td>
                  <td className="py-3">{e.voidCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

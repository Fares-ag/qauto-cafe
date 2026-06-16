'use client';

import type { DashboardAnalytics, ProductSalesReportRow } from '@qauto/shared-types';
import { Card, CardHeader, EmptyState } from '@qauto/ui';
import {
  SalesTrendChart,
  HourlySalesChart,
  PaymentMixChart,
  CategoryMixChart,
  TopProductsChart,
  OrderTypeChart,
  MarginGauge,
} from '@/components/charts/DashboardCharts';

type Props = {
  loading: boolean;
  businessDate: string;
  analytics: DashboardAnalytics | null;
  products: ProductSalesReportRow[];
  formatQar: (value: string) => string;
};

export function DashboardChartSection({
  loading,
  businessDate,
  analytics,
  products,
  formatQar,
}: Props) {
  const kpis = analytics?.kpis;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2" padding="lg">
          <CardHeader title="7-day sales trend" description="Net sales by business date" />
          {loading ? (
            <div className="h-[280px] animate-pulse rounded-lg bg-surface-sunken" />
          ) : analytics?.trend.length ? (
            <SalesTrendChart data={analytics.trend} formatValue={formatQar} />
          ) : (
            <EmptyState title="No trend data" description="Sales will appear after paid orders." />
          )}
        </Card>

        <Card padding="lg">
          <CardHeader title="Margin health" description="Today&apos;s profitability" />
          {loading ? (
            <div className="h-[280px] animate-pulse rounded-lg bg-surface-sunken" />
          ) : kpis ? (
            <MarginGauge marginPct={kpis.marginPct} foodCostPct={kpis.foodCostPct} />
          ) : null}
          {!loading && analytics?.categoryMix.length ? (
            <div className="mt-2 border-t border-border pt-4">
              <CategoryMixChart data={analytics.categoryMix} formatValue={formatQar} />
            </div>
          ) : null}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Hourly sales" description={`Daypart breakdown · ${businessDate}`} />
          {loading ? (
            <div className="h-[260px] animate-pulse rounded-lg bg-surface-sunken" />
          ) : (
            <HourlySalesChart data={analytics?.hourly ?? []} formatValue={formatQar} />
          )}
        </Card>

        <Card padding="lg">
          <CardHeader title="Payment mix" description="Tender breakdown" />
          {loading ? (
            <div className="h-[260px] animate-pulse rounded-lg bg-surface-sunken" />
          ) : (
            <PaymentMixChart data={analytics?.paymentMix ?? []} formatValue={formatQar} />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader title="Top products" description="Best sellers today" />
          {loading ? (
            <div className="h-[280px] animate-pulse rounded-lg bg-surface-sunken" />
          ) : (
            <TopProductsChart data={products} formatValue={formatQar} />
          )}
        </Card>

        <Card padding="lg">
          <CardHeader title="Order channels" description="Counter, takeaway, staff, comp" />
          {loading ? (
            <div className="h-[240px] animate-pulse rounded-lg bg-surface-sunken" />
          ) : (
            <OrderTypeChart data={analytics?.orderTypes ?? []} formatValue={formatQar} />
          )}
        </Card>
      </div>
    </>
  );
}

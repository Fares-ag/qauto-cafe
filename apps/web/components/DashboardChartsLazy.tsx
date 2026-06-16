'use client';

import dynamic from 'next/dynamic';
import type { DashboardAnalytics, ProductSalesReportRow } from '@qauto/shared-types';

const DashboardChartSection = dynamic(
  () => import('@/components/DashboardChartSection').then((m) => m.DashboardChartSection),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="h-[320px] animate-pulse rounded-xl bg-surface-sunken lg:col-span-2" />
          <div className="h-[320px] animate-pulse rounded-xl bg-surface-sunken" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[280px] animate-pulse rounded-xl bg-surface-sunken" />
          <div className="h-[280px] animate-pulse rounded-xl bg-surface-sunken" />
        </div>
      </div>
    ),
  },
);

type Props = {
  loading: boolean;
  businessDate: string;
  analytics: DashboardAnalytics | null;
  products: ProductSalesReportRow[];
  formatQar: (value: string) => string;
};

export function DashboardChartsLazy(props: Props) {
  return <DashboardChartSection {...props} />;
}

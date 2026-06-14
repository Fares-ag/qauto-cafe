'use client';

import { useCallback, useEffect, useState } from 'react';
import type { StockMovementRow } from '@qauto/shared-types';
import { Card, CardHeader, DataTable, EmptyState, PageHeader, TableSkeleton, useToast } from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatQar, formatQtyWithUom } from '@/lib/format';

export default function InventoryMovementsPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [movements, setMovements] = useState<StockMovementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const data = await getApiClient().getStockMovements(branchId, 50);
      setMovements(data);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load movements', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title="Stock history" description="Receipts, sales, waste, and transfers — all values in QAR" />

      <Card padding="lg">
        <CardHeader title="Recent movements" />
        {loading ? (
          <TableSkeleton rows={10} />
        ) : movements.length === 0 ? (
          <EmptyState title="No movements" description="Stock activity will appear here" />
        ) : (
          <DataTable
            rows={movements}
            getRowKey={(row) => row.id}
            columns={[
              {
                key: 'time',
                header: 'Time',
                cell: (row) => new Date(row.createdAt).toLocaleString(),
              },
              {
                key: 'type',
                header: 'Type',
                cell: (row) => (
                  <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-xs font-medium">
                    {row.type}
                  </span>
                ),
              },
              { key: 'ingredient', header: 'Ingredient', cell: (row) => row.ingredientName },
              {
                key: 'qty',
                header: 'Qty',
                cell: (row) => formatQtyWithUom(row.quantity, row.uom ?? ''),
              },
              {
                key: 'cost',
                header: 'Value (QAR)',
                cell: (row) => formatQar(row.extendedCost),
              },
              {
                key: 'by',
                header: 'By',
                cell: (row) => row.createdByName ?? '—',
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}

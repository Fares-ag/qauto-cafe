'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { InventoryStockItem } from '@qauto/api-client';
import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  KpiCard,
  PageHeader,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDisplayQty, formatQar } from '@/lib/format';

export default function InventoryOverviewPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [stock, setStock] = useState<InventoryStockItem[]>([]);
  const [totalValueQar, setTotalValueQar] = useState('0');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const data = await client.getInventoryStock(branchId);
      setStock(data.items);
      setTotalValueQar(data.totalValueQar ?? '0');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load inventory', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const lowStock = stock.filter((i) => i.isLow);
  const tracked = stock.filter((i) => !i.isPackaging);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock on hand, value in QAR, and reorder alerts"
        actions={
          <div className="flex flex-wrap gap-2">
            <Link href="/inventory/receive"><Button variant="secondary" size="sm">Receive</Button></Link>
            <Link href="/inventory/waste"><Button variant="secondary" size="sm">Waste</Button></Link>
            <Link href="/inventory/adjust"><Button variant="secondary" size="sm">Adjust</Button></Link>
            <Link href="/inventory/movements"><Button variant="ghost" size="sm">Movements</Button></Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Inventory value" value={formatQar(totalValueQar)} />
        <KpiCard label="Low stock items" value={String(lowStock.length)} />
        <KpiCard label="Tracked SKUs" value={String(tracked.length)} />
      </div>

      {loading ? (
        <TableSkeleton rows={8} />
      ) : stock.length === 0 ? (
        <EmptyState title="No stock data" />
      ) : (
        <DataTable
          rows={stock}
          getRowKey={(row) => row.ingredientId}
          emptyMessage="No stock data"
          columns={[
            {
              key: 'name',
              header: 'Ingredient',
              cell: (row) => (
                <div>
                  <p className="font-medium text-ink">{row.name}</p>
                  <p className="text-xs text-ink-muted">{row.code}</p>
                </div>
              ),
            },
            {
              key: 'available',
              header: 'On hand',
              cell: (row) => (
                <span className={row.isLow ? 'font-medium text-danger' : ''}>
                  {formatDisplayQty(row.available, row.uom)}
                </span>
              ),
            },
            {
              key: 'value',
              header: 'Value (QAR)',
              cell: (row) => formatQar(row.valueOnHandQar ?? '0'),
            },
            {
              key: 'reorder',
              header: 'Reorder at',
              cell: (row) =>
                row.reorderPoint ? formatDisplayQty(row.reorderPoint, row.uom) : '—',
            },
            {
              key: 'status',
              header: 'Status',
              cell: (row) =>
                row.isLow ? (
                  <Badge variant="warning">Low</Badge>
                ) : row.isPackaging ? (
                  <Badge variant="default">Packaging</Badge>
                ) : (
                  <Badge variant="success">OK</Badge>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}

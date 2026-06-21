'use client';

import { useMemo, useState } from 'react';
import type { OrderStatus } from '@qauto/shared-types';
import { useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, useToast } from '@qauto/ui';
import { Maximize2, Minimize2 } from 'lucide-react';
import { QueueColumn } from '@/components/QueueBoard';
import { useAuthStore } from '@/lib/auth-store';
import { withAuth } from '@/lib/api';
import { useOrderQueue } from '@/lib/queries';
import { queryKeys } from '@/lib/query-keys';
import { useUiStore } from '@/lib/ui-store';

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { branchId } = useAuthStore();
  const { kitchenDisplayMode, setKitchenDisplayMode } = useUiStore();
  const { data: orders = [], error, isFetching } = useOrderQueue(branchId, 3_000);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const grouped = useMemo(
    () => ({
      paid: orders.filter((o) => o.status === 'PAID' || o.status === 'PENDING_PAYMENT'),
      inPrep: orders.filter((o) => o.status === 'IN_PREP'),
      ready: orders.filter((o) => o.status === 'READY'),
    }),
    [orders],
  );

  async function handleBump(orderId: string, status: OrderStatus) {
    if (!branchId) return;
    setBumpingId(orderId);
    setActionError(null);
    try {
      await withAuth((client) => client.updateOrderStatus(orderId, status));
      await queryClient.invalidateQueries({ queryKey: queryKeys.orderQueue(branchId) });
      toast('Order updated', 'success');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setBumpingId(null);
    }
  }

  const loadError = error instanceof Error ? error.message : null;

  return (
    <div className={kitchenDisplayMode ? 'space-y-6' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`font-semibold tracking-tight text-ink ${kitchenDisplayMode ? 'text-2xl' : 'text-xl'}`}>
            Kitchen queue
          </h1>
          <p className="text-sm text-ink-muted">Tap the button on each ticket to move it forward</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={isFetching ? 'accent' : 'neutral'}>
            {isFetching ? '↻ Syncing' : '● Live from database'}
          </Badge>
          <Badge variant="accent">{orders.length} active</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKitchenDisplayMode(!kitchenDisplayMode)}
            className="gap-1.5"
          >
            {kitchenDisplayMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {kitchenDisplayMode ? 'Exit full screen' : 'Full screen'}
          </Button>
        </div>
      </div>

      {loadError ? <Alert variant="error">{loadError}</Alert> : null}
      {actionError ? <Alert variant="error">{actionError}</Alert> : null}

      <div className={`grid gap-4 ${kitchenDisplayMode ? 'lg:grid-cols-3 lg:gap-6' : 'lg:grid-cols-3'}`}>
        <QueueColumn
          title="NEW"
          orders={grouped.paid}
          onBump={handleBump}
          bumpingId={bumpingId}
          large={kitchenDisplayMode}
        />
        <QueueColumn
          title="PREPARING"
          orders={grouped.inPrep}
          onBump={handleBump}
          bumpingId={bumpingId}
          large={kitchenDisplayMode}
        />
        <QueueColumn
          title="READY"
          orders={grouped.ready}
          onBump={handleBump}
          bumpingId={bumpingId}
          large={kitchenDisplayMode}
        />
      </div>
    </div>
  );
}

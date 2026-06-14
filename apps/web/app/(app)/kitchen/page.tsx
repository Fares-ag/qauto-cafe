'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OrderStatus, QueueOrder } from '@qauto/shared-types';
import { Alert, Badge, Button, useToast } from '@qauto/ui';
import { Maximize2, Minimize2 } from 'lucide-react';
import { QueueColumn } from '@/components/QueueBoard';
import { useAuthStore } from '@/lib/auth-store';
import { withAuth } from '@/lib/api';
import { useUiStore } from '@/lib/ui-store';
import {
  applyStatusChange,
  connectQueueSocket,
  paidEventToQueueOrder,
  removeQueueOrder,
} from '@/lib/ws';

export default function KitchenPage() {
  const { toast } = useToast();
  const { branchId, accessToken } = useAuthStore();
  const { kitchenDisplayMode, setKitchenDisplayMode } = useUiStore();
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [connected, setConnected] = useState(false);
  const [bumpingId, setBumpingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    if (!branchId) return;
    const queue = await withAuth((client) => client.getOrderQueue(branchId));
    setOrders(queue);
  }, [branchId]);

  useEffect(() => {
    if (!accessToken || !branchId) return;

    let socket: Awaited<ReturnType<typeof connectQueueSocket>> | null = null;
    let cancelled = false;

    loadQueue().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to load queue');
    });

    connectQueueSocket(accessToken, branchId, {
      onSnapshot: (snapshot) => setOrders(snapshot.orders),
      onOrderPaid: (event) => {
        setOrders((current) => {
          const incoming = paidEventToQueueOrder(event);
          const without = current.filter((o) => o.id !== incoming.id);
          return [...without, incoming].sort((a, b) => a.orderNumber - b.orderNumber);
        });
      },
      onStatusChanged: (event) => {
        setOrders((current) => applyStatusChange(current, event));
      },
      onOrderVoided: (event) => {
        setOrders((current) => removeQueueOrder(current, event.orderId));
      },
      onConnectionChange: setConnected,
    })
      .then((s) => {
        if (cancelled) {
          s.disconnect();
          return;
        }
        socket = s;
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to connect live queue');
      });

    const poll = setInterval(() => {
      if (!connected) {
        loadQueue().catch(() => undefined);
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      socket?.disconnect();
    };
  }, [accessToken, branchId, loadQueue, connected]);

  const grouped = useMemo(
    () => ({
      paid: orders.filter((o) => o.status === 'PAID'),
      inPrep: orders.filter((o) => o.status === 'IN_PREP'),
      ready: orders.filter((o) => o.status === 'READY'),
    }),
    [orders],
  );

  async function handleBump(orderId: string, status: OrderStatus) {
    setBumpingId(orderId);
    setError(null);
    try {
      const updated = await withAuth((client) => client.updateOrderStatus(orderId, status));
      setOrders((current) => {
        if (updated.status === 'COMPLETED') {
          return current.filter((o) => o.id !== orderId);
        }
        return current.map((o) => (o.id === orderId ? updated : o));
      });
      toast('Order updated', 'success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update order');
    } finally {
      setBumpingId(null);
    }
  }

  return (
    <div className={kitchenDisplayMode ? 'space-y-6' : 'space-y-4'}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`font-semibold tracking-tight text-ink ${kitchenDisplayMode ? 'text-2xl' : 'text-xl'}`}>
            Kitchen queue
          </h1>
          <p className="text-sm text-ink-muted">Tap the button on each order to move it forward</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={connected ? 'success' : 'neutral'}>
            {connected ? '● Live' : '○ Polling'}
          </Badge>
          <Badge variant="accent">{orders.length} active</Badge>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setKitchenDisplayMode(!kitchenDisplayMode)}
            className="gap-1.5"
          >
            {kitchenDisplayMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            {kitchenDisplayMode ? 'Exit display' : 'Display mode'}
          </Button>
        </div>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <div className={`grid gap-4 ${kitchenDisplayMode ? 'lg:grid-cols-3 lg:gap-6' : 'lg:grid-cols-3'}`}>
        <QueueColumn
          title="NEW"
          orders={grouped.paid}
          onBump={handleBump}
          bumpingId={bumpingId}
          large={kitchenDisplayMode}
        />
        <QueueColumn
          title="IN PREP"
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

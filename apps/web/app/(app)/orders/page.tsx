'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Order } from '@qauto/shared-types';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  StatusBadge,
  TableSkeleton,
  useToast,
} from '@qauto/ui';
import { getApiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

type OrderRow = Awaited<ReturnType<ReturnType<typeof getApiClient>['listOrders']>>['items'][number];

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'PENDING_PAYMENT', label: 'Unpaid' },
  { value: 'PAID', label: 'Paid' },
  { value: 'IN_PREP', label: 'In prep' },
  { value: 'READY', label: 'Ready' },
  { value: 'COMPLETED', label: 'Done' },
  { value: 'VOIDED', label: 'Voided' },
  { value: 'REFUNDED', label: 'Refunded' },
];

export default function OrdersPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionOrder, setActionOrder] = useState<Order | null>(null);
  const [collectId, setCollectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [refundMode, setRefundMode] = useState<'full' | 'partial'>('full');
  const [selectedLineIds, setSelectedLineIds] = useState<string[]>([]);
  const [collecting, setCollecting] = useState(false);
  const [refunding, setRefunding] = useState(false);

  const load = useCallback(async () => {
    if (!branchId) return;
    setLoading(true);
    try {
      const client = getApiClient();
      const data = await client.listOrders(branchId, {
        status: statusFilter || undefined,
        limit: 50,
      });
      setOrders(data.items);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to load orders', 'error');
    } finally {
      setLoading(false);
    }
  }, [branchId, statusFilter, toast]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    if (!actionId) {
      setActionOrder(null);
      setSelectedLineIds([]);
      setRefundMode('full');
      return;
    }
    getApiClient()
      .getOrder(actionId)
      .then((order) => {
        setActionOrder(order);
        setSelectedLineIds(order.lines.map((l) => l.id));
      })
      .catch((err) =>
        toast(err instanceof Error ? err.message : 'Failed to load order', 'error'),
      );
  }, [actionId, toast]);

  function isUnpaid(order: OrderRow) {
    return order.status === 'PENDING_PAYMENT' || (Boolean(order.deferredAt) && !order.paidAt);
  }

  function canManage(order: OrderRow) {
    return ['PENDING_PAYMENT', 'PAID', 'IN_PREP', 'READY', 'COMPLETED', 'PARTIALLY_REFUNDED'].includes(
      order.status,
    );
  }

  async function voidOrder(orderId: string) {
    if (!reason.trim()) {
      toast('Enter a reason', 'error');
      return;
    }
    try {
      const client = getApiClient();
      await client.voidOrder(orderId, reason);
      toast('Order voided', 'success');
      setActionId(null);
      setReason('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Void failed', 'error');
    }
  }

  async function refundOrder(orderId: string) {
    if (!reason.trim()) {
      toast('Enter a reason', 'error');
      return;
    }
    if (refundMode === 'partial' && !selectedLineIds.length) {
      toast('Select at least one line', 'error');
      return;
    }
    setRefunding(true);
    try {
      const client = getApiClient();
      await client.refundOrder(orderId, {
        reason,
        idempotencyKey: crypto.randomUUID(),
        lineIds: refundMode === 'partial' ? selectedLineIds : undefined,
      });
      toast(refundMode === 'partial' ? 'Partial refund processed' : 'Order refunded', 'success');
      setActionId(null);
      setReason('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Refund failed', 'error');
    } finally {
      setRefunding(false);
    }
  }

  function toggleLine(lineId: string) {
    setSelectedLineIds((prev) =>
      prev.includes(lineId) ? prev.filter((id) => id !== lineId) : [...prev, lineId],
    );
  }

  async function collectPayment(order: OrderRow, method: 'CASH' | 'CARD') {
    setCollecting(true);
    try {
      const client = getApiClient();
      await client.collectPayment(order.id, {
        payments: [{ method, amount: order.total }],
        idempotencyKey: crypto.randomUUID(),
      });
      toast('Payment collected', 'success');
      setCollectId(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Payment failed', 'error');
    } finally {
      setCollecting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Orders</h1>
        <p className="mt-1 text-sm text-ink-muted">Collect payments and manage order history</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatusFilter(filter.value)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === filter.value
                ? 'bg-brand text-brand-foreground shadow-soft'
                : 'border border-border bg-surface-raised text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading ? (
        <TableSkeleton rows={6} />
      ) : orders.length === 0 ? (
        <Card padding="lg">
          <EmptyState title="No orders" description="Orders will appear here after sales" />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => (
            <Card
              key={order.id}
              padding="lg"
              className={`relative overflow-hidden ${isUnpaid(order) ? 'border-warning/40 ring-1 ring-warning/20' : ''}`}
            >
              {isUnpaid(order) ? (
                <div className="absolute left-0 top-0 h-full w-1 bg-warning" aria-hidden />
              ) : null}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-xl font-bold text-ink">#{order.orderNumber}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {new Date(order.createdAt).toLocaleString()}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="mt-3 space-y-1 text-sm">
                <p className="font-semibold text-brand">{order.total} QAR</p>
                {order.customerName ? (
                  <p className="text-ink-secondary">{order.customerName}</p>
                ) : (
                  <p className="text-ink-muted">Walk-in</p>
                )}
                {order.customerDepartment ? (
                  <p className="text-xs text-ink-muted">{order.customerDepartment}</p>
                ) : null}
                <p className="text-xs text-ink-muted">Staff: {order.createdByName}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {isUnpaid(order) ? (
                  <Button variant="primary" size="lg" className="flex-1" onClick={() => setCollectId(order.id)}>
                    Collect payment
                  </Button>
                ) : canManage(order) ? (
                  <Button variant="ghost" size="sm" onClick={() => setActionId(order.id)}>
                    Void / refund
                  </Button>
                ) : null}
              </div>
            </Card>
          ))}
        </div>
      )}

      {collectId ? (
        <Card padding="lg" className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 shadow-soft-lg">
          <CardHeader title="Collect payment" description="Choose payment method" />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="primary"
              size="lg"
              loading={collecting}
              onClick={() => {
                const order = orders.find((o) => o.id === collectId);
                if (order) collectPayment(order, 'CASH');
              }}
            >
              💵 Cash
            </Button>
            <Button
              variant="accent"
              size="lg"
              loading={collecting}
              onClick={() => {
                const order = orders.find((o) => o.id === collectId);
                if (order) collectPayment(order, 'CARD');
              }}
            >
              💳 Card
            </Button>
          </div>
          <Button variant="ghost" className="mt-2 w-full" onClick={() => setCollectId(null)}>
            Cancel
          </Button>
        </Card>
      ) : null}

      {actionId ? (
        <Card padding="lg" className="fixed bottom-6 left-1/2 z-40 w-full max-w-lg -translate-x-1/2 shadow-soft-lg">
          <CardHeader title="Void or refund order" />
          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Customer request, wrong order…"
          />

          {actionOrder ? (
            <div className="mt-4 space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRefundMode('full')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    refundMode === 'full' ? 'bg-brand-muted text-brand' : 'bg-surface-sunken'
                  }`}
                >
                  Full refund
                </button>
                <button
                  type="button"
                  onClick={() => setRefundMode('partial')}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    refundMode === 'partial' ? 'bg-brand-muted text-brand' : 'bg-surface-sunken'
                  }`}
                >
                  Line refund
                </button>
              </div>

              {refundMode === 'partial' ? (
                <ul className="max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
                  {actionOrder.lines.map((line) => (
                    <li key={line.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={selectedLineIds.includes(line.id)}
                        onChange={() => toggleLine(line.id)}
                      />
                      <span className="flex-1">
                        {line.quantity}× {line.itemName}
                        {line.sizeName ? ` (${line.sizeName})` : ''}
                      </span>
                      <span className="text-ink-muted">{line.lineTotal} QAR</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button variant="accent" onClick={() => voidOrder(actionId)}>
              Void
            </Button>
            <Button variant="primary" loading={refunding} onClick={() => refundOrder(actionId)}>
              Refund
            </Button>
            <Button variant="ghost" onClick={() => setActionId(null)}>
              Cancel
            </Button>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

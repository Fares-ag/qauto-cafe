'use client';

import { useCallback, useEffect, useState } from 'react';
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

export default function OrdersPage() {
  const branchId = useAuthStore((s) => s.branchId);
  const { toast } = useToast();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [actionId, setActionId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

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
    try {
      const client = getApiClient();
      await client.refundOrder(orderId, { reason, idempotencyKey: crypto.randomUUID() });
      toast('Order refunded', 'success');
      setActionId(null);
      setReason('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Refund failed', 'error');
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Orders</h1>
          <p className="mt-1 text-sm text-ink-muted">History, void, and refund</p>
        </div>
        <select
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="PAID">Paid</option>
          <option value="IN_PREP">In prep</option>
          <option value="READY">Ready</option>
          <option value="COMPLETED">Completed</option>
          <option value="VOIDED">Voided</option>
          <option value="REFUNDED">Refunded</option>
        </select>
      </div>

      <Card padding="lg">
        {loading ? (
          <TableSkeleton rows={8} />
        ) : orders.length === 0 ? (
          <EmptyState title="No orders" description="Orders will appear here after sales" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="pb-3 pr-4 font-medium">#</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Total</th>
                  <th className="pb-3 pr-4 font-medium">Staff</th>
                  <th className="pb-3 pr-4 font-medium">Created</th>
                  <th className="pb-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b border-border/60">
                    <td className="py-3 pr-4 font-medium text-ink">#{order.orderNumber}</td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="py-3 pr-4">{order.total} QAR</td>
                    <td className="py-3 pr-4 text-ink-secondary">{order.createdByName}</td>
                    <td className="py-3 pr-4 text-ink-secondary">
                      {new Date(order.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3">
                      {['PAID', 'IN_PREP', 'READY'].includes(order.status) ? (
                        <Button variant="ghost" size="sm" onClick={() => setActionId(order.id)}>
                          Void / Refund
                        </Button>
                      ) : null}
                      {['COMPLETED'].includes(order.status) ? (
                        <Button variant="ghost" size="sm" onClick={() => setActionId(order.id)}>
                          Refund
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {actionId ? (
        <Card padding="lg" className="fixed bottom-6 left-1/2 z-40 w-full max-w-md -translate-x-1/2 shadow-soft-lg">
          <CardHeader title="Void or refund order" />
          <Input
            label="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Customer request, wrong order…"
          />
          <div className="mt-4 flex gap-2">
            <Button variant="accent" onClick={() => voidOrder(actionId)}>
              Void
            </Button>
            <Button variant="primary" onClick={() => refundOrder(actionId)}>
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

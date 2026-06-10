'use client';

import type { OrderStatus, QueueOrder } from '@qauto/shared-types';
import { Badge, Button } from '@qauto/ui';

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PAID: 'IN_PREP',
  IN_PREP: 'READY',
  READY: 'COMPLETED',
};

const ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  PAID: 'Start prep',
  IN_PREP: 'Mark ready',
  READY: 'Complete',
};

export function OrderCard({
  order,
  onBump,
  busy,
}: {
  order: QueueOrder;
  onBump: (orderId: string, status: OrderStatus) => void;
  busy: boolean;
}) {
  const nextStatus = NEXT_STATUS[order.status as OrderStatus];
  const actionLabel = ACTION_LABEL[order.status as OrderStatus];

  return (
    <article className="rounded-xl border border-border bg-surface-raised p-4 shadow-soft transition-shadow duration-150 hover:shadow-card">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-2xl font-bold tracking-tight text-ink">#{order.orderNumber}</p>
          {order.paidAt ? (
            <p className="text-xs text-ink-muted">
              {new Date(order.paidAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          ) : null}
        </div>
        <Badge variant="neutral">{order.total} QAR</Badge>
      </div>

      <ul className="space-y-2 text-sm">
        {order.lines.map((line) => (
          <li key={line.id}>
            <span className="font-medium text-ink">
              {line.quantity}× {line.itemName}
              {line.sizeName ? ` (${line.sizeName})` : ''}
            </span>
            {line.modifiers.length > 0 ? (
              <p className="text-ink-muted">{line.modifiers.join(', ')}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {nextStatus && actionLabel ? (
        <Button
          variant="accent"
          size="lg"
          className="mt-4 w-full"
          disabled={busy}
          loading={busy}
          onClick={() => onBump(order.id, nextStatus)}
        >
          {actionLabel}
        </Button>
      ) : null}
    </article>
  );
}

export function QueueColumn({
  title,
  orders,
  onBump,
  bumpingId,
}: {
  title: string;
  orders: QueueOrder[];
  onBump: (orderId: string, status: OrderStatus) => void;
  bumpingId: string | null;
}) {
  return (
    <section className="flex min-h-[70vh] flex-col rounded-xl border border-border bg-surface-sunken/50 p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-accent">{title}</h2>
        <Badge variant="neutral">{orders.length}</Badge>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {orders.length === 0 ? (
          <p className="text-sm text-ink-muted">No orders</p>
        ) : (
          orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onBump={onBump}
              busy={bumpingId === order.id}
            />
          ))
        )}
      </div>
    </section>
  );
}

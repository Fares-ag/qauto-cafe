'use client';

import type { Socket } from 'socket.io-client';
import type {
  OrderPaidEvent,
  OrderQueueSnapshot,
  OrderStatusChangedEvent,
  OrderVoidedEvent,
  QueueOrder,
} from '@qauto/shared-types';
import { WS_CLIENT_EVENTS, WS_EVENTS } from '@qauto/shared-types';
import { wsBase } from './api';

export interface QueueSocketHandlers {
  onSnapshot: (snapshot: OrderQueueSnapshot) => void;
  onOrderPaid: (event: OrderPaidEvent) => void;
  onStatusChanged: (event: OrderStatusChangedEvent) => void;
  onOrderVoided: (event: OrderVoidedEvent) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export async function connectQueueSocket(
  token: string,
  branchId: string,
  handlers: QueueSocketHandlers,
): Promise<Socket> {
  const { io } = await import('socket.io-client');
  const socket = io(`${wsBase}/ws`, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
  });

  socket.on('connect', () => {
    handlers.onConnectionChange?.(true);
    socket.emit(WS_CLIENT_EVENTS.SUBSCRIBE, { branchId });
  });

  socket.on('disconnect', () => {
    handlers.onConnectionChange?.(false);
  });

  socket.on(WS_EVENTS.ORDER_QUEUE_SNAPSHOT, handlers.onSnapshot);
  socket.on(WS_EVENTS.ORDER_PAID, (event: OrderPaidEvent) => {
    handlers.onOrderPaid(event);
  });
  socket.on(WS_EVENTS.ORDER_STATUS_CHANGED, handlers.onStatusChanged);
  socket.on(WS_EVENTS.ORDER_VOIDED, handlers.onOrderVoided);

  return socket;
}

export function mergeQueueOrder(orders: QueueOrder[], incoming: QueueOrder): QueueOrder[] {
  const without = orders.filter((o) => o.id !== incoming.id);
  if (incoming.status === 'COMPLETED' || incoming.status === 'VOIDED') {
    return without;
  }
  return [...without, incoming].sort((a, b) => a.orderNumber - b.orderNumber);
}

export function removeQueueOrder(orders: QueueOrder[], orderId: string): QueueOrder[] {
  return orders.filter((o) => o.id !== orderId);
}

export function applyStatusChange(
  orders: QueueOrder[],
  event: OrderStatusChangedEvent,
): QueueOrder[] {
  if (event.status === 'COMPLETED' || event.status === 'VOIDED') {
    return removeQueueOrder(orders, event.orderId);
  }

  return orders.map((order) =>
    order.id === event.orderId
      ? { ...order, status: event.status, updatedAt: event.updatedAt }
      : order,
  );
}

export function paidEventToQueueOrder(event: OrderPaidEvent): QueueOrder {
  return {
    id: event.orderId,
    orderNumber: event.orderNumber,
    status: event.status,
    customerName: null,
    total: event.total,
    paidAt: event.paidAt,
    updatedAt: event.paidAt,
    lines: event.lines,
  };
}

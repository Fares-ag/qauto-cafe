import type { OrderStatus } from './index';

export interface QueueOrderLine {
  id: string;
  itemName: string;
  sizeName: string | null;
  quantity: number;
  modifiers: string[];
}

export interface QueueOrder {
  id: string;
  orderNumber: number;
  status: OrderStatus;
  customerName: string | null;
  customerDepartment: string | null;
  total: string;
  paidAt: string | null;
  deferredAt: string | null;
  paymentDueDate: string | null;
  updatedAt: string;
  lines: QueueOrderLine[];
}

export interface OrderQueueSnapshot {
  branchId: string;
  orders: QueueOrder[];
  fetchedAt: string;
}

export interface OrderPaidEvent {
  orderId: string;
  orderNumber: number;
  branchId: string;
  status: OrderStatus;
  total: string;
  paidAt: string;
  lines: QueueOrderLine[];
}

export interface OrderStatusChangedEvent {
  orderId: string;
  orderNumber: number;
  branchId: string;
  status: OrderStatus;
  updatedAt: string;
}

export interface OrderVoidedEvent {
  orderId: string;
  orderNumber: number;
  branchId: string;
  reason: string;
  voidedAt: string;
}

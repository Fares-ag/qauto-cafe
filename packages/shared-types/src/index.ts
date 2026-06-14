import type { StockShortageError } from './menu';

export type TerminalType = 'POS' | 'BAR_DISPLAY' | 'ADMIN';

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'IN_PREP'
  | 'READY'
  | 'COMPLETED'
  | 'VOIDED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  organizationId: string;
}

export interface LoginResponse {
  accessToken: string;
  expiresIn: number;
  user: AuthUser;
  branchId?: string;
}

export interface ApiErrorBody {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance?: string;
  errors?: Array<{ field: string; message: string }> | StockShortageError[];
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down' | 'skipped';
  };
}

export interface PaginatedMeta {
  page: number;
  limit: number;
  total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginatedMeta;
}

export const WS_EVENTS = {
  ORDER_PAID: 'order.paid',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  ORDER_VOIDED: 'order.voided',
  ORDER_QUEUE_SNAPSHOT: 'order.queue_snapshot',
  INVENTORY_UPDATED: 'inventory.updated',
  MENU_ITEM_86: 'menu.item_86',
  SHIFT_OPENED: 'shift.opened',
  SHIFT_CLOSED: 'shift.closed',
} as const;

export type WsEventName = (typeof WS_EVENTS)[keyof typeof WS_EVENTS];

export * from './menu';
export * from './inventory';
export * from './queue';
export * from './shifts';
export * from './reports';
export * from './ws';

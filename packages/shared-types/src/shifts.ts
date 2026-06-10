export type ShiftStatus = 'OPEN' | 'CLOSED';

export type ShiftCashEventType =
  | 'OPEN_FLOAT'
  | 'PAID_IN'
  | 'PAID_OUT'
  | 'DROP'
  | 'CLOSE_COUNT';

export interface ShiftCashEvent {
  id: string;
  type: ShiftCashEventType;
  amount: string;
  reason: string | null;
  createdAt: string;
}

export interface Shift {
  id: string;
  branchId: string;
  terminalId: string | null;
  status: ShiftStatus;
  openingFloat: string;
  expectedCash: string | null;
  actualCash: string | null;
  cashVariance: string | null;
  openedAt: string;
  closedAt: string | null;
  notes: string | null;
  cashEvents?: ShiftCashEvent[];
}

export interface ShiftSummary {
  shift: Shift;
  orderCount: number;
  grossSales: string;
  cashSales: string;
  cardSales: string;
  voidCount: number;
}

export interface ShiftOpenedEvent {
  shiftId: string;
  branchId: string;
  terminalId: string | null;
  openingFloat: string;
  openedAt: string;
}

export interface ShiftClosedEvent {
  shiftId: string;
  branchId: string;
  expectedCash: string;
  actualCash: string;
  cashVariance: string;
  closedAt: string;
}

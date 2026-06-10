import { Injectable } from '@nestjs/common';
import { WS_EVENTS } from '@qauto/shared-types';
import type {
  OrderPaidEvent,
  OrderQueueSnapshot,
  OrderStatusChangedEvent,
  OrderVoidedEvent,
  ShiftClosedEvent,
  ShiftOpenedEvent,
} from '@qauto/shared-types';
import { EventsGateway } from '../ws/events.gateway';

@Injectable()
export class DomainEventsService {
  private gateway: EventsGateway | null = null;

  registerGateway(gateway: EventsGateway) {
    this.gateway = gateway;
  }

  emitOrderPaid(branchId: string, payload: OrderPaidEvent) {
    this.gateway?.emitToBranch(branchId, WS_EVENTS.ORDER_PAID, payload);
  }

  emitOrderStatusChanged(branchId: string, payload: OrderStatusChangedEvent) {
    this.gateway?.emitToBranch(branchId, WS_EVENTS.ORDER_STATUS_CHANGED, payload);
  }

  emitOrderVoided(branchId: string, payload: OrderVoidedEvent) {
    this.gateway?.emitToBranch(branchId, WS_EVENTS.ORDER_VOIDED, payload);
  }

  emitQueueSnapshot(branchId: string, payload: OrderQueueSnapshot) {
    this.gateway?.emitToBranch(branchId, WS_EVENTS.ORDER_QUEUE_SNAPSHOT, payload);
  }

  emitShiftOpened(branchId: string, payload: ShiftOpenedEvent) {
    this.gateway?.emitToBranch(branchId, WS_EVENTS.SHIFT_OPENED, payload);
  }

  emitShiftClosed(branchId: string, payload: ShiftClosedEvent) {
    this.gateway?.emitToBranch(branchId, WS_EVENTS.SHIFT_CLOSED, payload);
  }
}

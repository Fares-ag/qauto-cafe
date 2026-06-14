import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Order, OrderStatus } from '@prisma/client';
import type { OrderStatus as SharedOrderStatus, QueueOrder } from '@qauto/shared-types';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToString } from '../common/utils/decimal.util';
import { DomainEventsService } from '../events/domain-events.service';
import { QUEUE_STATUSES } from './dto/update-order-status.dto';

const STATUS_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_PAYMENT: ['IN_PREP'],
  PAID: ['IN_PREP'],
  IN_PREP: ['READY'],
  READY: ['COMPLETED'],
};

@Injectable()
export class OrderQueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async getQueue(branchId: string, organizationId: string): Promise<QueueOrder[]> {
    await this.assertBranch(branchId, organizationId);

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        status: { in: QUEUE_STATUSES },
      },
      include: {
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: true },
        },
      },
      orderBy: [{ paidAt: 'asc' }, { deferredAt: 'asc' }, { orderNumber: 'asc' }],
    });

    return orders.map((order) => this.serializeQueueOrder(order));
  }

  async getQueueSnapshot(branchId: string, organizationId: string) {
    const orders = await this.getQueue(branchId, organizationId);
    return {
      branchId,
      orders,
      fetchedAt: new Date().toISOString(),
    };
  }

  async updateStatus(
    orderId: string,
    organizationId: string,
    nextStatus: OrderStatus,
  ): Promise<QueueOrder> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: true },
        },
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    const allowed = STATUS_TRANSITIONS[order.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition from ${order.status} to ${nextStatus}`,
      );
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: nextStatus,
        completedAt: nextStatus === 'COMPLETED' ? new Date() : undefined,
      },
      include: {
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: true },
        },
      },
    });

    this.domainEvents.emitOrderStatusChanged(order.branchId, {
      orderId: updated.id,
      orderNumber: updated.orderNumber,
      branchId: updated.branchId,
      status: updated.status as SharedOrderStatus,
      updatedAt: updated.updatedAt.toISOString(),
    });

    return this.serializeQueueOrder(updated);
  }

  buildPaidEvent(order: Order & {
    lines: Array<{
      id: string;
      itemName: string;
      sizeName: string | null;
      quantity: number;
      modifiers: Array<{ name: string }>;
    }>;
  }) {
    const queueOrder = this.serializeQueueOrder(order);
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      status: order.status as SharedOrderStatus,
      total: decimalToString(order.total),
      paidAt: order.paidAt?.toISOString() ?? order.deferredAt?.toISOString() ?? new Date().toISOString(),
      lines: queueOrder.lines,
    };
  }

  buildVoidedEvent(order: Order, reason: string) {
    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      reason,
      voidedAt: new Date().toISOString(),
    };
  }

  private serializeQueueOrder(
    order: Order & {
      lines: Array<{
        id: string;
        itemName: string;
        sizeName: string | null;
        quantity: number;
        modifiers: Array<{ name: string }>;
      }>;
    },
  ): QueueOrder {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status as SharedOrderStatus,
      customerName: order.customerName,
      customerDepartment: order.customerDepartment,
      total: decimalToString(order.total),
      paidAt: order.paidAt?.toISOString() ?? null,
      deferredAt: order.deferredAt?.toISOString() ?? null,
      paymentDueDate: order.paymentDueDate?.toISOString().slice(0, 10) ?? null,
      updatedAt: order.updatedAt.toISOString(),
      lines: order.lines.map((line) => ({
        id: line.id,
        itemName: line.itemName,
        sizeName: line.sizeName,
        quantity: line.quantity,
        modifiers: line.modifiers.map((m) => m.name),
      })),
    };
  }

  private async assertBranch(branchId: string, organizationId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null, isActive: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
  }
}

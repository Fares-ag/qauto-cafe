import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { OrderQueueService } from './order-queue.service';
import { DomainEventsService } from '../events/domain-events.service';
import { AuditService } from '../audit/audit.service';
import { UpdateOrderCustomerDto } from './dto/update-order-customer.dto';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class OrderDeferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly orderQueue: OrderQueueService,
    private readonly domainEvents: DomainEventsService,
    private readonly audit: AuditService,
  ) {}

  async updateCustomer(orderId: string, organizationId: string, dto: UpdateOrderCustomerDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!['DRAFT', 'PENDING_PAYMENT'].includes(order.status)) {
      throw new BadRequestException('Customer details cannot be updated for this order');
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        customerName: dto.customerName ?? order.customerName,
        customerDepartment: dto.customerDepartment ?? order.customerDepartment,
        customerId: dto.customerId ?? order.customerId,
        paymentDueDate: dto.paymentDueDate
          ? new Date(`${dto.paymentDueDate}T00:00:00.000Z`)
          : order.paymentDueDate,
      },
    });

    if (dto.customerId && !dto.customerName) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
      });
      if (customer) {
        const name = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
        await this.prisma.order.update({
          where: { id: order.id },
          data: {
            customerName: name || order.customerName,
            customerDepartment: customer.department ?? order.customerDepartment,
          },
        });
      }
    }

    const result = await this.prisma.order.findUnique({ where: { id: order.id } });

    return {
      id: result!.id,
      customerName: result!.customerName,
      customerDepartment: result!.customerDepartment,
      customerId: result!.customerId,
      paymentDueDate: result!.paymentDueDate?.toISOString().slice(0, 10) ?? null,
    };
  }

  async defer(orderId: string, organizationId: string, userId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        lines: { include: { modifiers: true } },
        branch: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DRAFT') throw new BadRequestException('Only draft orders can be deferred');
    if (!order.lines.length) throw new BadRequestException('Order has no lines');

    const { orderCogs } = await this.fulfillment.fulfillOrder(order, userId);
    const now = new Date();

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'PENDING_PAYMENT',
        cogsTotal: orderCogs,
        deferredAt: now,
      },
      include: {
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: true },
        },
      },
    });

    this.domainEvents.emitOrderPaid(
      updated.branchId,
      this.orderQueue.buildPaidEvent(updated),
    );

    await this.audit.log({
      organizationId,
      branchId: updated.branchId,
      userId,
      action: 'UPDATE',
      entityType: 'order',
      entityId: updated.id,
      afterState: {
        total: decimalToString(updated.total),
        orderNumber: updated.orderNumber,
        status: updated.status,
      },
    });

    return {
      order: {
        id: updated.id,
        orderNumber: updated.orderNumber,
        status: updated.status,
        total: decimalToString(updated.total),
        cogsTotal: decimalToString(updated.cogsTotal),
        deferredAt: updated.deferredAt?.toISOString(),
        customerName: updated.customerName,
        customerDepartment: updated.customerDepartment,
      },
    };
  }

  private resolveBusinessDate(cutoverHour: number): Date {
    const now = new Date();
    const business = new Date(now);
    if (now.getHours() < cutoverHour) {
      business.setDate(business.getDate() - 1);
    }
    business.setHours(0, 0, 0, 0);
    return business;
  }
}

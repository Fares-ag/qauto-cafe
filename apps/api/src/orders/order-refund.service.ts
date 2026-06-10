import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FifoService } from '../inventory/fifo.service';
import { EightySixService } from '../inventory/eighty-six.service';
import { LayerAllocation } from '../inventory/inventory.types';
import { AuditService } from '../audit/audit.service';
import { DomainEventsService } from '../events/domain-events.service';
import { JobsService } from '../jobs/jobs.service';
import { RefundOrderDto } from './dto/refund-order.dto';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class OrderRefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fifo: FifoService,
    private readonly eightySix: EightySixService,
    private readonly audit: AuditService,
    private readonly domainEvents: DomainEventsService,
    private readonly jobs: JobsService,
  ) {}

  async refund(orderId: string, organizationId: string, userId: string, dto: RefundOrderDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.refund.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { order: true },
      });
      if (existing?.order.organizationId === organizationId) {
        return this.buildResponse(existing.orderId, organizationId);
      }
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        payments: { where: { status: PaymentStatus.COMPLETED } },
        lines: {
          include: {
            bomSnapshot: {
              include: {
                lines: { include: { allocations: true } },
              },
            },
          },
        },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (!['PAID', 'IN_PREP', 'READY', 'COMPLETED'].includes(order.status)) {
      throw new BadRequestException('Order cannot be refunded');
    }

    const payment = order.payments[0];
    if (!payment) throw new BadRequestException('No completed payment found');

    const restock = dto.restockInventory !== false;
    const ingredientIds = new Set<string>();

    const refund = await this.prisma.$transaction(async (tx) => {
      if (restock) {
        for (const line of order.lines) {
          if (!line.bomSnapshot) continue;

          const allocations: LayerAllocation[] = line.bomSnapshot.lines.flatMap((snapLine) =>
            snapLine.allocations.map((a) => ({
              layerId: a.layerId,
              ingredientId: a.ingredientId,
              quantity: a.quantity,
              unitCost: a.unitCost,
              extendedCost: a.extendedCost,
            })),
          );

          allocations.forEach((a) => ingredientIds.add(a.ingredientId));

          await this.fifo.reverseAllocations(
            tx,
            order.branchId,
            allocations,
            { type: 'order_refund', id: order.id },
            userId,
            StockMovementType.REFUND_REVERSAL,
          );
        }
      }

      const created = await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: payment.id,
          status: 'COMPLETED',
          amount: order.total,
          reason: dto.reason,
          restockInventory: restock,
          idempotencyKey: dto.idempotencyKey,
          processedById: userId,
          processedAt: new Date(),
        },
      });

      await tx.order.update({
        where: { id: order.id },
        data: { status: 'REFUNDED' },
      });

      return created;
    });

    if (restock) {
      for (const ingredientId of ingredientIds) {
        await this.eightySix.propagateAfterRestock(order.branchId, ingredientId);
      }
    }

    await this.audit.log({
      organizationId,
      branchId: order.branchId,
      userId,
      action: 'REFUND',
      entityType: 'order',
      entityId: order.id,
      afterState: { refundId: refund.id, amount: decimalToString(refund.amount), reason: dto.reason },
    });

    this.domainEvents.emitOrderVoided(order.branchId, {
      orderId: order.id,
      orderNumber: order.orderNumber,
      branchId: order.branchId,
      reason: `Refunded: ${dto.reason}`,
      voidedAt: new Date().toISOString(),
    });

    await this.jobs.enqueueOrderAggregation(order.id, 'order_voided');

    return this.buildResponse(order.id, organizationId);
  }

  private async buildResponse(orderId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: { refunds: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    if (!order) throw new NotFoundException('Order not found');

    return {
      success: true,
      orderId: order.id,
      status: order.status,
      refund: order.refunds[0]
        ? {
            id: order.refunds[0].id,
            amount: decimalToString(order.refunds[0].amount),
            reason: order.refunds[0].reason,
            processedAt: order.refunds[0].processedAt?.toISOString(),
          }
        : null,
    };
  }
}

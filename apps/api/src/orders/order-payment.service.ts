import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InsufficientStockError } from '../inventory/inventory.types';
import { PayOrderDto, VoidOrderDto } from './dto/pay-order.dto';
import { decimalToString } from '../common/utils/decimal.util';
import { DomainEventsService } from '../events/domain-events.service';
import { OrderQueueService } from './order-queue.service';
import { OrderFulfillmentService } from './order-fulfillment.service';
import { JobsService } from '../jobs/jobs.service';
import { AuditService } from '../audit/audit.service';
import { FifoService } from '../inventory/fifo.service';
import { EightySixService } from '../inventory/eighty-six.service';
import { LayerAllocation } from '../inventory/inventory.types';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { GiftCardsService } from '../gift-cards/gift-cards.service';
import { OrderDiscountService } from './order-discount.service';
import { PRISMA_TX_OPTIONS } from '../prisma/transaction-options';
import { DiscountScope, DiscountType } from '@prisma/client';

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fulfillment: OrderFulfillmentService,
    private readonly fifo: FifoService,
    private readonly eightySix: EightySixService,
    private readonly domainEvents: DomainEventsService,
    private readonly orderQueue: OrderQueueService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
    private readonly loyalty: LoyaltyService,
    private readonly giftCards: GiftCardsService,
    private readonly orderDiscount: OrderDiscountService,
  ) {}

  async pay(orderId: string, organizationId: string, userId: string, dto: PayOrderDto) {
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
        include: { order: true },
      });
      if (existing?.order.organizationId === organizationId) {
        return this.buildPayResponse(existing.orderId, organizationId);
      }
    }

    let order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        lines: { include: { modifiers: true } },
        branch: true,
        payments: { where: { status: 'COMPLETED' } },
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    const hasCompletedPayment = order.payments.some((p) => p.status === 'COMPLETED');
    const isDraft = order.status === 'DRAFT';
    const isPayLater = Boolean(order.deferredAt) && !hasCompletedPayment;

    if (!isDraft && !isPayLater) {
      throw new BadRequestException('Order is not payable');
    }
    if (!order.lines.length) throw new BadRequestException('Order has no lines');

    if (order.customerId && (dto.loyaltyPointsRedeem || dto.rewardId)) {
      const customerId = order.customerId;
      const orderIdForDiscount = order.id;
      if (dto.rewardId) {
        await this.prisma.$transaction(async (tx) => {
          const { discountAmount } = await this.loyalty.redeemReward(
            tx,
            customerId,
            orderIdForDiscount,
            dto.rewardId!,
          );
          await tx.orderDiscount.deleteMany({ where: { orderId: orderIdForDiscount } });
          await tx.orderDiscount.create({
            data: {
              orderId: orderIdForDiscount,
              scope: DiscountScope.ORDER,
              type: DiscountType.FIXED_AMOUNT,
              value: discountAmount,
              amount: discountAmount,
              reason: 'Loyalty reward redemption',
            },
          });
          await this.orderDiscount.recalculateForOrder(orderIdForDiscount, tx);
        });
      } else if (dto.loyaltyPointsRedeem) {
        await this.prisma.$transaction(async (tx) => {
          const discountAmount = await this.loyalty.redeemPoints(
            tx,
            customerId,
            orderIdForDiscount,
            dto.loyaltyPointsRedeem!,
          );
          await tx.orderDiscount.deleteMany({ where: { orderId: orderIdForDiscount } });
          await tx.orderDiscount.create({
            data: {
              orderId: orderIdForDiscount,
              scope: DiscountScope.ORDER,
              type: DiscountType.FIXED_AMOUNT,
              value: discountAmount,
              amount: discountAmount,
              reason: 'Loyalty points redemption',
            },
          });
          await this.orderDiscount.recalculateForOrder(orderIdForDiscount, tx);
        });
      }
      const refreshed = await this.prisma.order.findFirst({
        where: { id: orderId, organizationId },
        include: {
          lines: { include: { modifiers: true } },
          branch: true,
          payments: { where: { status: 'COMPLETED' } },
        },
      });
      if (!refreshed) throw new NotFoundException('Order not found');
      order = refreshed;
    }

    const paymentTotal = dto.payments.reduce(
      (acc, p) => acc.add(new Prisma.Decimal(p.amount)),
      new Prisma.Decimal(0),
    );

    if (!paymentTotal.eq(order.total)) {
      throw new BadRequestException(
        `Payment total ${paymentTotal.toFixed(4)} does not match order total ${order.total.toFixed(4)}`,
      );
    }

    const isPayLaterCollection = isPayLater && !isDraft;

    const resolveGiftCardRef = (payment: (typeof dto.payments)[number]) =>
      payment.reference?.toUpperCase().startsWith('GC-')
        ? payment.reference
        : dto.giftCardCode && payment.method === 'OTHER'
          ? dto.giftCardCode
          : null;

    try {
      if (isPayLaterCollection) {
        await this.prisma.$transaction(async (tx) => {
          for (const payment of dto.payments) {
            const giftCardRef = resolveGiftCardRef(payment);
            if (giftCardRef) {
              await this.giftCards.redeem(
                tx,
                giftCardRef,
                new Prisma.Decimal(payment.amount),
                order.id,
              );
            }

            await tx.payment.create({
              data: {
                orderId: order.id,
                method: payment.method,
                status: PaymentStatus.COMPLETED,
                amount: payment.amount,
                reference: giftCardRef ?? payment.reference,
                idempotencyKey: dto.idempotencyKey,
                processedById: userId,
                processedAt: new Date(),
              },
            });
          }

          const paidAt = new Date();
          const businessDate = this.resolveBusinessDate(
            paidAt,
            order.branch.businessDayCutoverHour,
          );

          await tx.order.update({
            where: { id: order.id },
            data: {
              ...(order.status === 'PENDING_PAYMENT' ? { status: 'PAID' as const } : {}),
              paidAt,
              businessDate,
            },
          });

          await tx.receipt.create({
            data: {
              orderId: order.id,
              content: {
                orderNumber: order.orderNumber,
                total: decimalToString(order.total),
                cogsTotal: decimalToString(order.cogsTotal),
                paidAt: new Date().toISOString(),
                payLater: true,
              },
            },
          });

          if (order.customerId) {
            await this.loyalty.earnOnPayment(tx, order.customerId, order.id, order.total);
          }
        }, PRISMA_TX_OPTIONS);
      } else {
        const prep = await this.fulfillment.prepareFulfillment(order);
        let consumedIngredientIds: string[] = [];

        await this.prisma.$transaction(async (tx) => {
          const { orderCogs, consumedIngredientIds: consumed } =
            await this.fulfillment.applyFulfillmentInTx(tx, order, userId, prep);
          consumedIngredientIds = consumed;

          for (const payment of dto.payments) {
            const giftCardRef = resolveGiftCardRef(payment);
            if (giftCardRef) {
              await this.giftCards.redeem(
                tx,
                giftCardRef,
                new Prisma.Decimal(payment.amount),
                order.id,
              );
            }

            await tx.payment.create({
              data: {
                orderId: order.id,
                method: payment.method,
                status: PaymentStatus.COMPLETED,
                amount: payment.amount,
                reference: giftCardRef ?? payment.reference,
                idempotencyKey: dto.idempotencyKey,
                processedById: userId,
                processedAt: new Date(),
              },
            });
          }

          const businessDate = this.resolveBusinessDate(order.branch.businessDayCutoverHour);

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'PAID',
              cogsTotal: orderCogs,
              paidAt: new Date(),
              businessDate,
            },
          });

          await tx.receipt.create({
            data: {
              orderId: order.id,
              content: {
                orderNumber: order.orderNumber,
                total: decimalToString(order.total),
                cogsTotal: decimalToString(orderCogs),
                paidAt: new Date().toISOString(),
              },
            },
          });

          if (order.customerId) {
            await this.loyalty.earnOnPayment(tx, order.customerId, order.id, order.total);
          }
        }, PRISMA_TX_OPTIONS);

        this.fulfillment.scheduleEightySixPropagation(order.branchId, consumedIngredientIds);
      }
    } catch (error) {
      if (error instanceof InsufficientStockError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Duplicate payment request');
      }
      throw error;
    }

    const paidAt = new Date();

    if (isDraft) {
      this.domainEvents.emitOrderPaid(
        order.branchId,
        this.orderQueue.buildPaidEvent({
          ...order,
          status: 'PAID',
          paidAt,
        }),
      );
    }
    this.jobs.scheduleOrderAggregation(order.id, 'order_paid');
    void this.audit
      .log({
        organizationId,
        branchId: order.branchId,
        userId,
        action: 'PAY',
        entityType: 'order',
        entityId: order.id,
        afterState: { total: decimalToString(order.total), orderNumber: order.orderNumber },
      })
      .catch(() => undefined);

    return this.buildPayResponse(order.id, organizationId);
  }

  async voidOrder(orderId: string, organizationId: string, userId: string, dto: VoidOrderDto) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
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
    if (!['PENDING_PAYMENT', 'PAID', 'IN_PREP', 'READY'].includes(order.status)) {
      throw new BadRequestException('Order cannot be voided');
    }

    const ingredientIds = new Set<string>();

    await this.prisma.$transaction(async (tx) => {
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
          { type: 'order_void', id: order.id },
          userId,
        );
      }

      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'VOIDED',
          voidedById: userId,
          voidReason: dto.reason,
          voidedAt: new Date(),
        },
      });
    }, PRISMA_TX_OPTIONS);

    for (const ingredientId of ingredientIds) {
      void this.eightySix.propagateAfterRestock(order.branchId, ingredientId).catch(() => undefined);
    }

    this.domainEvents.emitOrderVoided(
      order.branchId,
      this.orderQueue.buildVoidedEvent(order, dto.reason),
    );
    this.jobs.scheduleOrderAggregation(order.id, 'order_voided');

    void this.audit
      .log({
        organizationId,
        branchId: order.branchId,
        userId,
        action: 'VOID',
        entityType: 'order',
        entityId: order.id,
        afterState: { reason: dto.reason },
      })
      .catch(() => undefined);

    return { success: true, orderId: order.id, status: 'VOIDED' };
  }

  private resolveBusinessDate(from: Date | number, cutoverHour?: number): Date {
    if (typeof from === 'number') {
      const hour = from;
      const now = new Date();
      const business = new Date(now);
      if (now.getHours() < hour) business.setDate(business.getDate() - 1);
      business.setHours(0, 0, 0, 0);
      return business;
    }
    const business = new Date(from);
    const cutover = cutoverHour ?? 4;
    if (from.getHours() < cutover) business.setDate(business.getDate() - 1);
    business.setHours(0, 0, 0, 0);
    return business;
  }

  private async buildPayResponse(orderId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        lines: {
          orderBy: { sortOrder: 'asc' },
          select: {
            id: true,
            itemName: true,
            lineCogs: true,
          },
        },
        receipts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });

    if (!order) throw new NotFoundException('Order not found');

    return {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: decimalToString(order.total),
        cogsTotal: decimalToString(order.cogsTotal),
        paidAt: order.paidAt?.toISOString(),
      },
      receipt: order.receipts[0] ?? null,
      consumption: order.lines.map((line) => ({
        orderLineId: line.id,
        itemName: line.itemName,
        cogs: decimalToString(line.lineCogs),
      })),
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { OrderType, PaymentMethodType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getHourBucket, resolveBusinessDate } from '../common/utils/business-date.util';

export type AggregationAction = 'order_paid' | 'order_voided' | 'order_refunded';

export interface AggregationOptions {
  refundId?: string;
  lineIds?: string[];
}

type OrderWithDetails = Awaited<ReturnType<ReportAggregationService['loadOrder']>>;

@Injectable()
export class ReportAggregationService {
  private readonly logger = new Logger(ReportAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async aggregateOrder(orderId: string, action: AggregationAction, options: AggregationOptions = {}) {
    const order = await this.loadOrder(orderId);
    if (!order) {
      this.logger.warn(`Order ${orderId} not found for aggregation`);
      return;
    }

    const cutover = order.branch.businessDayCutoverHour;
    const dedupeKey = this.buildDedupeKey(action, orderId, options);
    if (!dedupeKey) return;

    const already = await this.prisma.orderAggregationLedger.findUnique({
      where: { dedupeKey },
    });
    if (already) {
      this.logger.debug(`Skipping duplicate aggregation ${dedupeKey}`);
      return;
    }

    if (action === 'order_voided') {
      const wasPaid = await this.prisma.orderAggregationLedger.findFirst({
        where: { orderId, action: 'order_paid' },
      });
      if (!wasPaid) {
        this.logger.debug(`Skipping void aggregation for unpaid order ${orderId}`);
        return;
      }
    }

    if (action === 'order_paid') {
      if (!order.paidAt) {
        this.logger.warn(`Skipping pay aggregation — no paidAt on ${orderId}`);
        return;
      }
      const businessDate = resolveBusinessDate(order.paidAt, cutover);
      await this.applyPaid(order, businessDate, cutover, 1);
      await this.recordLedger(orderId, action, dedupeKey, { paidAt: order.paidAt.toISOString() });
      return;
    }

    if (action === 'order_voided') {
      const businessDate = order.businessDate ?? (order.paidAt ? resolveBusinessDate(order.paidAt, cutover) : null);
      if (!businessDate) return;
      await this.applyPaid(order, businessDate, cutover, -1);
      await this.applyDailyDelta(order.branchId, businessDate, { voidCount: 1 });
      await this.recordLedger(orderId, action, dedupeKey, {});
      return;
    }

    if (action === 'order_refunded') {
      await this.applyRefund(order, options, cutover);
      await this.recordLedger(orderId, action, dedupeKey, {
        refundId: options.refundId,
        lineIds: options.lineIds,
      });
    }
  }

  private async applyPaid(
    order: NonNullable<OrderWithDetails>,
    businessDate: Date,
    cutover: number,
    sign: number,
  ) {
    const s = sign;
    const payments = this.summarizePayments(order.payments);

    let drinkSales = new Prisma.Decimal(0);
    let snackSales = new Prisma.Decimal(0);
    for (const line of order.lines) {
      const sales = line.lineTotal.mul(s);
      if (line.menuItem.type === 'DRINK') drinkSales = drinkSales.add(sales);
      else snackSales = snackSales.add(sales);
    }

    await this.applyDailyDelta(order.branchId, businessDate, {
      orderCount: s,
      grossSales: order.subtotal.mul(s),
      netSales: order.total.mul(s),
      discountTotal: order.discountTotal.mul(s),
      taxTotal: order.taxTotal.mul(s),
      cogsTotal: order.cogsTotal.mul(s),
      cashTotal: payments.cash.mul(s),
      cardTotal: payments.card.mul(s),
      corporateTotal: payments.corporate.mul(s),
      otherTotal: payments.other.mul(s),
      tipTotal: payments.tips.mul(s),
      drinkSales,
      snackSales,
    });

    if (sign > 0 && order.paidAt) {
      const hour = getHourBucket(order.paidAt, cutover);
      await this.prisma.hourlySalesSummary.upsert({
        where: {
          branchId_businessDate_hour: {
            branchId: order.branchId,
            businessDate,
            hour,
          },
        },
        create: {
          branchId: order.branchId,
          businessDate,
          hour,
          orderCount: 1,
          netSales: order.total,
        },
        update: {
          orderCount: { increment: 1 },
          netSales: { increment: order.total },
          refreshedAt: new Date(),
        },
      });
    } else if (sign < 0 && order.paidAt) {
      const hour = getHourBucket(order.paidAt, cutover);
      await this.prisma.hourlySalesSummary.updateMany({
        where: { branchId: order.branchId, businessDate, hour },
        data: {
          orderCount: { decrement: 1 },
          netSales: { decrement: order.total },
          refreshedAt: new Date(),
        },
      });
    }

    await this.prisma.orderTypeSummary.upsert({
      where: {
        branchId_businessDate_orderType: {
          branchId: order.branchId,
          businessDate,
          orderType: order.orderType,
        },
      },
      create: {
        branchId: order.branchId,
        businessDate,
        orderType: order.orderType,
        orderCount: s,
        netSales: order.total.mul(s),
      },
      update: {
        orderCount: { increment: s },
        netSales: { increment: order.total.mul(s) },
        refreshedAt: new Date(),
      },
    });

    for (const line of order.lines) {
      await this.prisma.productSalesSummary.upsert({
        where: {
          branchId_menuItemId_businessDate: {
            branchId: order.branchId,
            menuItemId: line.menuItemId,
            businessDate,
          },
        },
        create: {
          branchId: order.branchId,
          menuItemId: line.menuItemId,
          businessDate,
          quantitySold: line.quantity * s,
          grossSales: line.lineSubtotal.mul(s),
          cogsTotal: line.lineCogs.mul(s),
        },
        update: {
          quantitySold: { increment: line.quantity * s },
          grossSales: { increment: line.lineSubtotal.mul(s) },
          cogsTotal: { increment: line.lineCogs.mul(s) },
          refreshedAt: new Date(),
        },
      });

      if (!line.bomSnapshot) continue;
      for (const snapLine of line.bomSnapshot.lines) {
        await this.prisma.ingredientUsageSummary.upsert({
          where: {
            branchId_ingredientId_businessDate: {
              branchId: order.branchId,
              ingredientId: snapLine.ingredientId,
              businessDate,
            },
          },
          create: {
            branchId: order.branchId,
            ingredientId: snapLine.ingredientId,
            businessDate,
            quantityUsed: snapLine.quantity.mul(s),
            uomCode: snapLine.uom.code,
            valueUsed: snapLine.extendedCost.mul(s),
          },
          update: {
            quantityUsed: { increment: snapLine.quantity.mul(s) },
            valueUsed: { increment: snapLine.extendedCost.mul(s) },
            refreshedAt: new Date(),
          },
        });
      }
    }

    const cashierId = order.payments[0]?.processedById ?? order.createdById;
    await this.prisma.employeeActivitySummary.upsert({
      where: {
        branchId_userId_businessDate: {
          branchId: order.branchId,
          userId: cashierId,
          businessDate,
        },
      },
      create: {
        branchId: order.branchId,
        userId: cashierId,
        businessDate,
        ordersHandled: s,
        grossSales: order.total.mul(s),
        discountTotal: order.discountTotal.mul(s),
      },
      update: {
        ordersHandled: { increment: s },
        grossSales: { increment: order.total.mul(s) },
        discountTotal: { increment: order.discountTotal.mul(s) },
        refreshedAt: new Date(),
      },
    });
  }

  private async applyRefund(
    order: NonNullable<OrderWithDetails>,
    options: AggregationOptions,
    cutover: number,
  ) {
    const refund = options.refundId
      ? await this.prisma.refund.findUnique({ where: { id: options.refundId } })
      : null;
    if (!refund) {
      this.logger.warn(`Refund ${options.refundId} not found`);
      return;
    }

    const businessDate =
      order.businessDate ?? (order.paidAt ? resolveBusinessDate(order.paidAt, cutover) : null);
    if (!businessDate) return;

    const linesToRefund = options.lineIds?.length
      ? order.lines.filter((l) => options.lineIds!.includes(l.id))
      : order.lines;

    const refundSubtotal = linesToRefund.reduce(
      (acc, l) => acc.add(l.lineSubtotal),
      new Prisma.Decimal(0),
    );
    const refundNet = linesToRefund.reduce(
      (acc, l) => acc.add(l.lineTotal),
      new Prisma.Decimal(0),
    );
    const refundCogs = linesToRefund.reduce(
      (acc, l) => acc.add(l.lineCogs),
      new Prisma.Decimal(0),
    );

    let drinkSales = new Prisma.Decimal(0);
    let snackSales = new Prisma.Decimal(0);
    for (const line of linesToRefund) {
      if (line.menuItem.type === 'DRINK') drinkSales = drinkSales.add(line.lineTotal);
      else snackSales = snackSales.add(line.lineTotal);
    }

    await this.applyDailyDelta(order.branchId, businessDate, {
      netSales: refundNet.neg(),
      grossSales: refundSubtotal.neg(),
      cogsTotal: refundCogs.neg(),
      refundTotal: refund.amount,
      drinkSales: drinkSales.neg(),
      snackSales: snackSales.neg(),
    });

    for (const line of linesToRefund) {
      await this.prisma.productSalesSummary.updateMany({
        where: {
          branchId: order.branchId,
          menuItemId: line.menuItemId,
          businessDate,
        },
        data: {
          quantitySold: { decrement: line.quantity },
          grossSales: { decrement: line.lineTotal },
          cogsTotal: { decrement: line.lineCogs },
          refreshedAt: new Date(),
        },
      });

      if (!line.bomSnapshot) continue;
      for (const snapLine of line.bomSnapshot.lines) {
        await this.prisma.ingredientUsageSummary.updateMany({
          where: {
            branchId: order.branchId,
            ingredientId: snapLine.ingredientId,
            businessDate,
          },
          data: {
            quantityUsed: { decrement: snapLine.quantity },
            valueUsed: { decrement: snapLine.extendedCost },
            refreshedAt: new Date(),
          },
        });
      }
    }

    const cashierId = order.payments[0]?.processedById ?? order.createdById;
    await this.prisma.employeeActivitySummary.updateMany({
      where: { branchId: order.branchId, userId: cashierId, businessDate },
      data: {
        refundTotal: { increment: refund.amount },
        refreshedAt: new Date(),
      },
    });
  }

  private async applyDailyDelta(
    branchId: string,
    businessDate: Date,
    delta: {
      orderCount?: number;
      grossSales?: Prisma.Decimal;
      netSales?: Prisma.Decimal;
      discountTotal?: Prisma.Decimal;
      taxTotal?: Prisma.Decimal;
      cogsTotal?: Prisma.Decimal;
      cashTotal?: Prisma.Decimal;
      cardTotal?: Prisma.Decimal;
      corporateTotal?: Prisma.Decimal;
      otherTotal?: Prisma.Decimal;
      tipTotal?: Prisma.Decimal;
      voidCount?: number;
      refundTotal?: Prisma.Decimal;
      drinkSales?: Prisma.Decimal;
      snackSales?: Prisma.Decimal;
    },
  ) {
    const zero = new Prisma.Decimal(0);
    await this.prisma.dailySalesSummary.upsert({
      where: { branchId_businessDate: { branchId, businessDate } },
      create: {
        branchId,
        businessDate,
        orderCount: delta.orderCount ?? 0,
        grossSales: delta.grossSales ?? zero,
        netSales: delta.netSales ?? zero,
        discountTotal: delta.discountTotal ?? zero,
        taxTotal: delta.taxTotal ?? zero,
        cogsTotal: delta.cogsTotal ?? zero,
        cashTotal: delta.cashTotal ?? zero,
        cardTotal: delta.cardTotal ?? zero,
        corporateTotal: delta.corporateTotal ?? zero,
        otherTotal: delta.otherTotal ?? zero,
        tipTotal: delta.tipTotal ?? zero,
        voidCount: delta.voidCount ?? 0,
        refundTotal: delta.refundTotal ?? zero,
        drinkSales: delta.drinkSales ?? zero,
        snackSales: delta.snackSales ?? zero,
      },
      update: {
        ...(delta.orderCount !== undefined ? { orderCount: { increment: delta.orderCount } } : {}),
        ...(delta.grossSales ? { grossSales: { increment: delta.grossSales } } : {}),
        ...(delta.netSales ? { netSales: { increment: delta.netSales } } : {}),
        ...(delta.discountTotal ? { discountTotal: { increment: delta.discountTotal } } : {}),
        ...(delta.taxTotal ? { taxTotal: { increment: delta.taxTotal } } : {}),
        ...(delta.cogsTotal ? { cogsTotal: { increment: delta.cogsTotal } } : {}),
        ...(delta.cashTotal ? { cashTotal: { increment: delta.cashTotal } } : {}),
        ...(delta.cardTotal ? { cardTotal: { increment: delta.cardTotal } } : {}),
        ...(delta.corporateTotal ? { corporateTotal: { increment: delta.corporateTotal } } : {}),
        ...(delta.otherTotal ? { otherTotal: { increment: delta.otherTotal } } : {}),
        ...(delta.tipTotal ? { tipTotal: { increment: delta.tipTotal } } : {}),
        ...(delta.voidCount !== undefined ? { voidCount: { increment: delta.voidCount } } : {}),
        ...(delta.refundTotal ? { refundTotal: { increment: delta.refundTotal } } : {}),
        ...(delta.drinkSales ? { drinkSales: { increment: delta.drinkSales } } : {}),
        ...(delta.snackSales ? { snackSales: { increment: delta.snackSales } } : {}),
        refreshedAt: new Date(),
      },
    });
  }

  private summarizePayments(payments: Array<{ method: PaymentMethodType; amount: Prisma.Decimal; tipAmount: Prisma.Decimal }>) {
    let cash = new Prisma.Decimal(0);
    let card = new Prisma.Decimal(0);
    let corporate = new Prisma.Decimal(0);
    let other = new Prisma.Decimal(0);
    let tips = new Prisma.Decimal(0);

    for (const p of payments) {
      tips = tips.add(p.tipAmount);
      if (p.method === PaymentMethodType.CASH) cash = cash.add(p.amount);
      else if (p.method === PaymentMethodType.CARD) card = card.add(p.amount);
      else if (p.method === PaymentMethodType.CORPORATE) corporate = corporate.add(p.amount);
      else other = other.add(p.amount);
    }

    return { cash, card, corporate, other, tips };
  }

  private buildDedupeKey(action: AggregationAction, orderId: string, options: AggregationOptions) {
    if (action === 'order_paid') return `paid:${orderId}`;
    if (action === 'order_voided') return `void:${orderId}`;
    if (action === 'order_refunded') {
      if (!options.refundId) return null;
      return `refund:${options.refundId}`;
    }
    return null;
  }

  private async recordLedger(
    orderId: string,
    action: string,
    dedupeKey: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.orderAggregationLedger.create({
      data: { orderId, action, dedupeKey, metadata: metadata as Prisma.InputJsonValue },
    });
  }

  private loadOrder(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        branch: { select: { businessDayCutoverHour: true } },
        lines: {
          include: {
            menuItem: true,
            bomSnapshot: { include: { lines: { include: { uom: true } } } },
          },
        },
        payments: { where: { status: 'COMPLETED' } },
      },
    });
  }
}

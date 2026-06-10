import { Injectable, Logger } from '@nestjs/common';
import { PaymentMethodType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type AggregationAction = 'order_paid' | 'order_voided';

@Injectable()
export class ReportAggregationService {
  private readonly logger = new Logger(ReportAggregationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async aggregateOrder(orderId: string, action: AggregationAction) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        lines: {
          include: {
            menuItem: true,
            bomSnapshot: { include: { lines: { include: { uom: true } } } },
          },
        },
        payments: { where: { status: 'COMPLETED' } },
      },
    });

    if (!order?.businessDate) {
      this.logger.warn(`Skipping aggregation for order ${orderId} — no business date`);
      return;
    }

    const sign = action === 'order_voided' ? -1 : 1;
    const businessDate = order.businessDate;

    let cashTotal = new Prisma.Decimal(0);
    let cardTotal = new Prisma.Decimal(0);
    for (const payment of order.payments) {
      if (payment.method === PaymentMethodType.CASH) {
        cashTotal = cashTotal.add(payment.amount);
      } else if (payment.method === PaymentMethodType.CARD) {
        cardTotal = cardTotal.add(payment.amount);
      }
    }

    let drinkSales = new Prisma.Decimal(0);
    let snackSales = new Prisma.Decimal(0);
    for (const line of order.lines) {
      const sales = line.lineTotal.mul(sign);
      if (line.menuItem.type === 'DRINK') {
        drinkSales = drinkSales.add(sales);
      } else {
        snackSales = snackSales.add(sales);
      }
    }

    await this.prisma.dailySalesSummary.upsert({
      where: {
        branchId_businessDate: {
          branchId: order.branchId,
          businessDate,
        },
      },
      create: {
        branchId: order.branchId,
        businessDate,
        orderCount: sign,
        grossSales: order.total.mul(sign),
        netSales: order.total.mul(sign),
        discountTotal: order.discountTotal.mul(sign),
        taxTotal: order.taxTotal.mul(sign),
        cogsTotal: order.cogsTotal.mul(sign),
        cashTotal: cashTotal.mul(sign),
        cardTotal: cardTotal.mul(sign),
        voidCount: action === 'order_voided' ? 1 : 0,
        drinkSales,
        snackSales,
      },
      update: {
        orderCount: { increment: sign },
        grossSales: { increment: order.total.mul(sign) },
        netSales: { increment: order.total.mul(sign) },
        discountTotal: { increment: order.discountTotal.mul(sign) },
        taxTotal: { increment: order.taxTotal.mul(sign) },
        cogsTotal: { increment: order.cogsTotal.mul(sign) },
        cashTotal: { increment: cashTotal.mul(sign) },
        cardTotal: { increment: cardTotal.mul(sign) },
        voidCount: { increment: action === 'order_voided' ? 1 : 0 },
        drinkSales: { increment: drinkSales },
        snackSales: { increment: snackSales },
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
          quantitySold: line.quantity * sign,
          grossSales: line.lineTotal.mul(sign),
          cogsTotal: line.lineCogs.mul(sign),
        },
        update: {
          quantitySold: { increment: line.quantity * sign },
          grossSales: { increment: line.lineTotal.mul(sign) },
          cogsTotal: { increment: line.lineCogs.mul(sign) },
          refreshedAt: new Date(),
        },
      });
    }

    for (const line of order.lines) {
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
            quantityUsed: snapLine.quantity.mul(sign),
            uomCode: snapLine.uom.code,
            valueUsed: snapLine.extendedCost.mul(sign),
          },
          update: {
            quantityUsed: { increment: snapLine.quantity.mul(sign) },
            valueUsed: { increment: snapLine.extendedCost.mul(sign) },
            refreshedAt: new Date(),
          },
        });
      }
    }

    await this.prisma.employeeActivitySummary.upsert({
      where: {
        branchId_userId_businessDate: {
          branchId: order.branchId,
          userId: order.createdById,
          businessDate,
        },
      },
      create: {
        branchId: order.branchId,
        userId: order.createdById,
        businessDate,
        ordersHandled: sign,
        grossSales: order.total.mul(sign),
        voidCount: action === 'order_voided' ? 1 : 0,
        discountTotal: order.discountTotal.mul(sign),
      },
      update: {
        ordersHandled: { increment: sign },
        grossSales: { increment: order.total.mul(sign) },
        voidCount: { increment: action === 'order_voided' ? 1 : 0 },
        discountTotal: { increment: order.discountTotal.mul(sign) },
        refreshedAt: new Date(),
      },
    });
  }
}

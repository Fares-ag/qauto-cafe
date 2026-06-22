import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DiscountScope, DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  computeDiscountAmount,
  computeLineTotalsAfterDiscount,
} from '../common/utils/order-money.util';
import { decimalToString } from '../common/utils/decimal.util';
import { ApplyOrderDiscountDto } from './dto/apply-discount.dto';

@Injectable()
export class OrderDiscountService {
  constructor(private readonly prisma: PrismaService) {}

  async apply(orderId: string, organizationId: string, dto: ApplyOrderDiscountDto) {
    const order = await this.getDraftOrder(orderId, organizationId);

    if (dto.scope === DiscountScope.LINE && !dto.orderLineId) {
      throw new BadRequestException('orderLineId is required for line discounts');
    }

    if (dto.scope === DiscountScope.LINE) {
      const line = await this.prisma.orderLine.findFirst({
        where: { id: dto.orderLineId, orderId },
      });
      if (!line) throw new BadRequestException('Order line not found');
    }

    const value = new Prisma.Decimal(dto.value);
    if (value.lte(0)) {
      throw new BadRequestException('Discount value must be positive');
    }
    if (dto.type === DiscountType.PERCENTAGE && value.gt(100)) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.orderDiscount.deleteMany({ where: { orderId } });

      const amount = await this.previewAmount(orderId, dto);

      await tx.orderDiscount.create({
        data: {
          orderId,
          scope: dto.scope,
          type: dto.type,
          value,
          amount,
          reason: dto.reason,
          orderLineId: dto.scope === DiscountScope.LINE ? dto.orderLineId : null,
        },
      });

      await this.recalculateForOrder(orderId, tx);
    });

    return { orderId };
  }

  async clear(orderId: string, organizationId: string) {
    await this.getDraftOrder(orderId, organizationId);

    await this.prisma.$transaction(async (tx) => {
      await tx.orderDiscount.deleteMany({ where: { orderId } });
      await this.recalculateForOrder(orderId, tx);
    });

    return { orderId };
  }

  async list(orderId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');

    const discounts = await this.prisma.orderDiscount.findMany({
      where: { orderId },
      orderBy: { createdAt: 'asc' },
    });
    return this.serializeDiscounts(discounts);
  }

  async removeById(orderId: string, organizationId: string, discountId: string) {
    await this.getDraftOrder(orderId, organizationId);
    const discount = await this.prisma.orderDiscount.findFirst({
      where: { id: discountId, orderId },
    });
    if (!discount) throw new NotFoundException('Discount not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.orderDiscount.delete({ where: { id: discountId } });
      await this.recalculateForOrder(orderId, tx);
    });

    return { id: discountId, removed: true };
  }

  async recalculateForOrder(orderId: string, tx: Prisma.TransactionClient = this.prisma) {
    const lines = await tx.orderLine.findMany({
      where: { orderId },
      orderBy: { sortOrder: 'asc' },
    });

    const discounts = await tx.orderDiscount.findMany({ where: { orderId } });

    const lineDiscounts = new Map<string, Prisma.Decimal>();
    for (const line of lines) {
      lineDiscounts.set(line.id, new Prisma.Decimal(0));
    }

    const subtotal = lines.reduce(
      (acc, line) => acc.add(line.lineSubtotal),
      new Prisma.Decimal(0),
    );

    for (const discount of discounts) {
      if (discount.scope === DiscountScope.LINE && discount.orderLineId) {
        const line = lines.find((l) => l.id === discount.orderLineId);
        if (!line) continue;
        const amount = computeDiscountAmount(
          line.lineSubtotal,
          discount.type,
          discount.value,
        );
        lineDiscounts.set(line.id, amount);
      } else if (discount.scope === DiscountScope.ORDER) {
        const orderDiscountAmount = computeDiscountAmount(
          subtotal,
          discount.type,
          discount.value,
        );
        if (subtotal.gt(0)) {
          for (const line of lines) {
            const share = line.lineSubtotal.div(subtotal).mul(orderDiscountAmount);
            lineDiscounts.set(line.id, (lineDiscounts.get(line.id) ?? new Prisma.Decimal(0)).add(share));
          }
        }
      }
    }

    let orderSubtotal = new Prisma.Decimal(0);
    let orderDiscountTotal = new Prisma.Decimal(0);
    let orderTaxTotal = new Prisma.Decimal(0);
    let orderTotal = new Prisma.Decimal(0);

    for (const line of lines) {
      const lineDiscount = lineDiscounts.get(line.id) ?? new Prisma.Decimal(0);
      const totals = computeLineTotalsAfterDiscount(line.lineSubtotal, line.lineTax, lineDiscount);

      await tx.orderLine.update({
        where: { id: line.id },
        data: {
          lineDiscount: totals.lineDiscount,
          lineTax: totals.lineTax,
          lineTotal: totals.lineTotal,
        },
      });

      orderSubtotal = orderSubtotal.add(line.lineSubtotal);
      orderDiscountTotal = orderDiscountTotal.add(totals.lineDiscount);
      orderTaxTotal = orderTaxTotal.add(totals.lineTax);
      orderTotal = orderTotal.add(totals.lineTotal);
    }

    await tx.order.update({
      where: { id: orderId },
      data: {
        subtotal: orderSubtotal,
        discountTotal: orderDiscountTotal,
        taxTotal: orderTaxTotal,
        total: orderTotal,
      },
    });

    if (discounts.length === 1) {
      const discount = discounts[0];
      const actualAmount =
        discount.scope === DiscountScope.LINE && discount.orderLineId
          ? lineDiscounts.get(discount.orderLineId) ?? new Prisma.Decimal(0)
          : orderDiscountTotal;
      await tx.orderDiscount.update({
        where: { id: discount.id },
        data: { amount: actualAmount },
      });
    }
  }

  private async previewAmount(orderId: string, dto: ApplyOrderDiscountDto): Promise<Prisma.Decimal> {
    const lines = await this.prisma.orderLine.findMany({ where: { orderId } });
    if (!lines.length) throw new BadRequestException('Order has no lines');

    if (dto.scope === DiscountScope.LINE && dto.orderLineId) {
      const line = lines.find((l) => l.id === dto.orderLineId);
      if (!line) throw new BadRequestException('Order line not found');
      return computeDiscountAmount(
        line.lineSubtotal,
        dto.type,
        new Prisma.Decimal(dto.value),
      );
    }

    const subtotal = lines.reduce(
      (acc, line) => acc.add(line.lineSubtotal),
      new Prisma.Decimal(0),
    );
    return computeDiscountAmount(subtotal, dto.type, new Prisma.Decimal(dto.value));
  }

  private async getDraftOrder(orderId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
    });
    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Only draft orders can receive discounts');
    }
    return order;
  }

  serializeDiscounts(
    discounts: Array<{
      id: string;
      scope: string;
      type: string;
      value: Prisma.Decimal;
      amount: Prisma.Decimal;
      reason: string | null;
      orderLineId: string | null;
    }>,
  ) {
    return discounts.map((d) => ({
      id: d.id,
      scope: d.scope,
      type: d.type,
      value: decimalToString(d.value),
      amount: decimalToString(d.amount),
      reason: d.reason,
      orderLineId: d.orderLineId,
    }));
  }
}

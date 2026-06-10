import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto, OrderLineInputDto, UpdateOrderLinesDto } from './dto/order.dto';
import { decimalToString } from '../common/utils/decimal.util';

interface ResolvedLine {
  menuItemId: string;
  sizeId: string | null;
  itemName: string;
  sizeName: string | null;
  quantity: number;
  unitPrice: Prisma.Decimal;
  lineSubtotal: Prisma.Decimal;
  lineDiscount: Prisma.Decimal;
  lineTax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  notes: string | null;
  modifierIds: string[];
  modifiers: Array<{ modifierId: string; name: string; priceAdjustment: Prisma.Decimal }>;
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateOrderDto) {
    await this.assertBranch(organizationId, dto.branchId);

    const orderNumber = await this.nextOrderNumber(dto.branchId);

    const order = await this.prisma.order.create({
      data: {
        organizationId,
        branchId: dto.branchId,
        terminalId: dto.terminalId,
        shiftId: dto.shiftId,
        orderNumber,
        orderType: dto.orderType ?? 'COUNTER',
        customerName: dto.customerName,
        status: 'DRAFT',
        createdById: userId,
      },
    });

    if (dto.lines?.length) {
      return this.replaceLines(order.id, organizationId, dto.lines);
    }

    return this.findOne(order.id, organizationId);
  }

  async list(
    organizationId: string,
    query: {
      branchId: string;
      status?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    await this.assertBranch(organizationId, query.branchId);
    const limit = Math.min(query.limit ?? 50, 100);
    const offset = query.offset ?? 0;

    const where = {
      organizationId,
      branchId: query.branchId,
      ...(query.status ? { status: query.status as Prisma.EnumOrderStatusFilter['equals'] } : {}),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          lines: { select: { id: true, itemName: true, quantity: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      items: orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        orderType: order.orderType,
        total: decimalToString(order.total),
        lineCount: order.lines.length,
        createdByName: `${order.createdBy.firstName} ${order.createdBy.lastName}`,
        paidAt: order.paidAt?.toISOString() ?? null,
        createdAt: order.createdAt.toISOString(),
      })),
      total,
      limit,
      offset,
    };
  }

  async replaceLines(orderId: string, organizationId: string, lines: OrderLineInputDto[]) {
    const order = await this.getDraftOrder(orderId, organizationId);

    const resolved = await Promise.all(
      lines.map((line, index) => this.resolveLine(order.branchId, line, index)),
    );

    const totals = this.calculateOrderTotals(resolved);

    await this.prisma.$transaction(async (tx) => {
      await tx.orderLineModifier.deleteMany({ where: { orderLine: { orderId } } });
      await tx.orderLine.deleteMany({ where: { orderId } });

      for (const [index, line] of resolved.entries()) {
        const createdLine = await tx.orderLine.create({
          data: {
            orderId,
            menuItemId: line.menuItemId,
            sizeId: line.sizeId,
            itemName: line.itemName,
            sizeName: line.sizeName,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineSubtotal: line.lineSubtotal,
            lineDiscount: line.lineDiscount,
            lineTax: line.lineTax,
            lineTotal: line.lineTotal,
            notes: line.notes,
            sortOrder: index,
          },
        });

        if (line.modifiers.length) {
          await tx.orderLineModifier.createMany({
            data: line.modifiers.map((mod) => ({
              orderLineId: createdLine.id,
              modifierId: mod.modifierId,
              name: mod.name,
              priceAdjustment: mod.priceAdjustment,
            })),
          });
        }
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: totals.subtotal,
          discountTotal: totals.discountTotal,
          taxTotal: totals.taxTotal,
          total: totals.total,
        },
      });
    });

    return this.findOne(orderId, organizationId);
  }

  async findOne(orderId: string, organizationId: string) {
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

    return this.serializeOrder(order);
  }

  private async getDraftOrder(orderId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'DRAFT') {
      throw new BadRequestException('Only draft orders can be modified');
    }

    return order;
  }

  private async assertBranch(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null, isActive: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
  }

  private async nextOrderNumber(branchId: string): Promise<number> {
    const last = await this.prisma.order.findFirst({
      where: { branchId },
      orderBy: { orderNumber: 'desc' },
      select: { orderNumber: true },
    });

    return (last?.orderNumber ?? 0) + 1;
  }

  private async resolveLine(branchId: string, input: OrderLineInputDto, sortOrder: number): Promise<ResolvedLine> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: input.menuItemId, isActive: true, deletedAt: null },
      include: {
        sizes: true,
        branchAvailability: { where: { branchId } },
        modifierGroups: {
          include: {
            modifierGroup: {
              include: { modifiers: true },
            },
          },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Menu item not found: ${input.menuItemId}`);
    }

    const availability = item.branchAvailability[0];
    if (availability?.is86 || availability?.isAvailable === false) {
      throw new BadRequestException(`${item.name} is not available`);
    }

    let sizeId: string | null = null;
    let sizeName: string | null = null;
    let priceAdjustment = new Prisma.Decimal(0);

    if (item.type === 'DRINK') {
      const size = item.sizes.find((s) => s.id === input.sizeId) ?? item.sizes.find((s) => s.isDefault) ?? item.sizes[0];
      if (!size) {
        throw new BadRequestException(`Size required for ${item.name}`);
      }
      sizeId = size.id;
      sizeName = size.name;
      priceAdjustment = size.priceAdjustment;
    }

    const basePrice = availability?.priceOverride ?? item.basePrice;
    const allowedModifierIds = new Set(
      item.modifierGroups.flatMap((g) => g.modifierGroup.modifiers.map((m) => m.id)),
    );

    const modifierIds = input.modifierIds ?? [];
    const modifiers: ResolvedLine['modifiers'] = [];

    for (const modifierId of modifierIds) {
      if (!allowedModifierIds.has(modifierId)) {
        throw new BadRequestException(`Modifier ${modifierId} is not valid for ${item.name}`);
      }

      const modifier = item.modifierGroups
        .flatMap((g) => g.modifierGroup.modifiers)
        .find((m) => m.id === modifierId);

      if (modifier) {
        modifiers.push({
          modifierId: modifier.id,
          name: modifier.name,
          priceAdjustment: modifier.priceAdjustment,
        });
      }
    }

    const modifierTotal = modifiers.reduce(
      (acc, m) => acc.add(m.priceAdjustment),
      new Prisma.Decimal(0),
    );

    const unitPrice = basePrice.add(priceAdjustment).add(modifierTotal);
    const lineSubtotal = unitPrice.mul(input.quantity);
    const lineDiscount = new Prisma.Decimal(0);
    const taxRate = item.taxRate;
    const taxable = lineSubtotal.sub(lineDiscount);
    const lineTax = taxable.mul(taxRate);
    const lineTotal = taxable.add(lineTax);

    return {
      menuItemId: item.id,
      sizeId,
      itemName: item.name,
      sizeName,
      quantity: input.quantity,
      unitPrice,
      lineSubtotal,
      lineDiscount,
      lineTax,
      lineTotal,
      notes: input.notes ?? null,
      modifierIds,
      modifiers,
    };
  }

  private calculateOrderTotals(lines: ResolvedLine[]) {
    const subtotal = lines.reduce((acc, l) => acc.add(l.lineSubtotal), new Prisma.Decimal(0));
    const discountTotal = lines.reduce((acc, l) => acc.add(l.lineDiscount), new Prisma.Decimal(0));
    const taxTotal = lines.reduce((acc, l) => acc.add(l.lineTax), new Prisma.Decimal(0));
    const total = lines.reduce((acc, l) => acc.add(l.lineTotal), new Prisma.Decimal(0));

    return { subtotal, discountTotal, taxTotal, total };
  }

  private serializeOrder(order: {
    id: string;
    branchId: string;
    orderNumber: number;
    status: string;
    orderType: string;
    customerName: string | null;
    subtotal: Prisma.Decimal;
    discountTotal: Prisma.Decimal;
    taxTotal: Prisma.Decimal;
    total: Prisma.Decimal;
    createdAt: Date;
    updatedAt: Date;
    lines: Array<{
      id: string;
      menuItemId: string;
      sizeId: string | null;
      itemName: string;
      sizeName: string | null;
      quantity: number;
      unitPrice: Prisma.Decimal;
      lineSubtotal: Prisma.Decimal;
      lineDiscount: Prisma.Decimal;
      lineTax: Prisma.Decimal;
      lineTotal: Prisma.Decimal;
      notes: string | null;
      modifiers: Array<{
        id: string;
        modifierId: string;
        name: string;
        priceAdjustment: Prisma.Decimal;
      }>;
    }>;
  }) {
    return {
      id: order.id,
      branchId: order.branchId,
      orderNumber: order.orderNumber,
      status: order.status,
      orderType: order.orderType,
      customerName: order.customerName,
      subtotal: decimalToString(order.subtotal),
      discountTotal: decimalToString(order.discountTotal),
      taxTotal: decimalToString(order.taxTotal),
      total: decimalToString(order.total),
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
      lines: order.lines.map((line) => ({
        id: line.id,
        menuItemId: line.menuItemId,
        sizeId: line.sizeId,
        itemName: line.itemName,
        sizeName: line.sizeName,
        quantity: line.quantity,
        unitPrice: decimalToString(line.unitPrice),
        lineSubtotal: decimalToString(line.lineSubtotal),
        lineDiscount: decimalToString(line.lineDiscount),
        lineTax: decimalToString(line.lineTax),
        lineTotal: decimalToString(line.lineTotal),
        notes: line.notes,
        modifiers: line.modifiers.map((mod) => ({
          id: mod.id,
          modifierId: mod.modifierId,
          name: mod.name,
          priceAdjustment: decimalToString(mod.priceAdjustment),
        })),
      })),
    };
  }
}

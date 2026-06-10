import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeEngineService } from '../recipe/recipe-engine.service';
import { FifoService } from '../inventory/fifo.service';
import { EightySixService } from '../inventory/eighty-six.service';
import { InsufficientStockError, LayerAllocation } from '../inventory/inventory.types';
import { PayOrderDto, VoidOrderDto } from './dto/pay-order.dto';
import { decimalToString } from '../common/utils/decimal.util';
import { DomainEventsService } from '../events/domain-events.service';
import { OrderQueueService } from './order-queue.service';
import { JobsService } from '../jobs/jobs.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrderPaymentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeEngine: RecipeEngineService,
    private readonly fifo: FifoService,
    private readonly eightySix: EightySixService,
    private readonly domainEvents: DomainEventsService,
    private readonly orderQueue: OrderQueueService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
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

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        lines: { include: { modifiers: true } },
        branch: true,
      },
    });

    if (!order) throw new NotFoundException('Order not found');
    if (order.status !== 'DRAFT') throw new BadRequestException('Order is not payable');
    if (!order.lines.length) throw new BadRequestException('Order has no lines');

    const paymentTotal = dto.payments.reduce(
      (acc, p) => acc.add(new Prisma.Decimal(p.amount)),
      new Prisma.Decimal(0),
    );

    if (!paymentTotal.eq(order.total)) {
      throw new BadRequestException(
        `Payment total ${paymentTotal.toFixed(4)} does not match order total ${order.total.toFixed(4)}`,
      );
    }

    const lineBoms = await Promise.all(
      order.lines.map(async (line) => {
        const bom = await this.recipeEngine.resolveBom({
          menuItemId: line.menuItemId,
          sizeId: line.sizeId,
          modifierIds: line.modifiers.map((m) => m.modifierId),
          quantity: line.quantity,
        });
        return { line, bom };
      }),
    );

    const allBomLines = lineBoms.flatMap(({ bom }) => bom.lines);
    const shortages = await this.fifo.checkAvailability(order.branchId, allBomLines);

    if (shortages.length) {
      throw new InsufficientStockError(shortages);
    }

    const consumedIngredientIds = new Set<string>();

    try {
      await this.prisma.$transaction(async (tx) => {
        let orderCogs = new Prisma.Decimal(0);

        for (const { line, bom } of lineBoms) {
          const consumption = await this.fifo.consume(
            tx,
            order.branchId,
            bom.lines,
            { type: 'order_line', id: line.id },
            userId,
          );

          orderCogs = orderCogs.add(consumption.totalCost);
          bom.lines.forEach((l) => consumedIngredientIds.add(l.ingredientId));

          const snapshot = await tx.orderLineBomSnapshot.create({
            data: {
              orderLineId: line.id,
              recipeId: bom.recipeId,
              recipeVersion: bom.recipeVersion,
              totalCogs: consumption.totalCost,
            },
          });

          const allocationsByIngredient = this.groupAllocations(consumption.allocations);

          for (const bomLine of bom.lines) {
            const lineAllocations = allocationsByIngredient.get(bomLine.ingredientId) ?? [];
            const extendedCost = lineAllocations.reduce(
              (acc, a) => acc.add(a.extendedCost),
              new Prisma.Decimal(0),
            );

            const snapshotLine = await tx.orderLineBomSnapshotLine.create({
              data: {
                snapshotId: snapshot.id,
                ingredientId: bomLine.ingredientId,
                ingredientName: bomLine.ingredientName,
                quantity: bomLine.quantity,
                uomId: bomLine.uomId,
                extendedCost,
              },
            });

            for (const allocation of lineAllocations) {
              await tx.orderLineLayerAllocation.create({
                data: {
                  snapshotLineId: snapshotLine.id,
                  layerId: allocation.layerId,
                  ingredientId: allocation.ingredientId,
                  quantity: allocation.quantity,
                  unitCost: allocation.unitCost,
                  extendedCost: allocation.extendedCost,
                },
              });
            }
          }

          await tx.orderLine.update({
            where: { id: line.id },
            data: { lineCogs: consumption.totalCost },
          });
        }

        for (const payment of dto.payments) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: payment.method,
              status: PaymentStatus.COMPLETED,
              amount: payment.amount,
              reference: payment.reference,
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
      });
    } catch (error) {
      if (error instanceof InsufficientStockError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Duplicate payment request');
      }
      throw error;
    }

    await this.eightySix.propagateAfterConsumption(
      order.branchId,
      Array.from(consumedIngredientIds),
    );

    const paidOrder = await this.prisma.order.findFirst({
      where: { id: order.id, organizationId },
      include: {
        lines: {
          orderBy: { sortOrder: 'asc' },
          include: { modifiers: true },
        },
      },
    });

    if (paidOrder) {
      this.domainEvents.emitOrderPaid(
        paidOrder.branchId,
        this.orderQueue.buildPaidEvent(paidOrder),
      );
      await this.jobs.enqueueOrderAggregation(paidOrder.id, 'order_paid');
      await this.audit.log({
        organizationId,
        branchId: paidOrder.branchId,
        userId,
        action: 'PAY',
        entityType: 'order',
        entityId: paidOrder.id,
        afterState: { total: decimalToString(paidOrder.total), orderNumber: paidOrder.orderNumber },
      });
    }

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
    if (!['PAID', 'IN_PREP', 'READY'].includes(order.status)) {
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
    });

    for (const ingredientId of ingredientIds) {
      await this.eightySix.propagateAfterRestock(order.branchId, ingredientId);
    }

    this.domainEvents.emitOrderVoided(
      order.branchId,
      this.orderQueue.buildVoidedEvent(order, dto.reason),
    );
    await this.jobs.enqueueOrderAggregation(order.id, 'order_voided');

    await this.audit.log({
      organizationId,
      branchId: order.branchId,
      userId,
      action: 'VOID',
      entityType: 'order',
      entityId: order.id,
      afterState: { reason: dto.reason },
    });

    return { success: true, orderId: order.id, status: 'VOIDED' };
  }

  private groupAllocations(allocations: LayerAllocation[]) {
    const map = new Map<string, LayerAllocation[]>();
    for (const allocation of allocations) {
      const list = map.get(allocation.ingredientId) ?? [];
      list.push(allocation);
      map.set(allocation.ingredientId, list);
    }
    return map;
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

  private async buildPayResponse(orderId: string, organizationId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, organizationId },
      include: {
        lines: {
          include: {
            modifiers: true,
            bomSnapshot: { include: { lines: { include: { allocations: true } } } },
          },
        },
        payments: true,
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
        ingredients: line.bomSnapshot?.lines.map((l) => ({
          name: l.ingredientName,
          quantity: decimalToString(l.quantity),
          cost: decimalToString(l.extendedCost),
        })),
      })),
    };
  }
}

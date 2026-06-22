import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeEngineService } from '../recipe/recipe-engine.service';
import { FifoService } from '../inventory/fifo.service';
import { EightySixService } from '../inventory/eighty-six.service';
import { InsufficientStockError, LayerAllocation } from '../inventory/inventory.types';
import { PRISMA_TX_OPTIONS } from '../prisma/transaction-options';

type ResolvedBom = Awaited<ReturnType<RecipeEngineService['resolveBom']>>;

export type OrderWithLines = {
  id: string;
  branchId: string;
  lines: Array<{
    id: string;
    menuItemId: string;
    sizeId: string | null;
    modifiers: Array<{ modifierId: string }>;
    quantity: number;
  }>;
};

export type FulfillmentLineBom = {
  line: OrderWithLines['lines'][number];
  bom: ResolvedBom;
};

export type FulfillmentPrep = {
  existingCogs: Prisma.Decimal;
  lineBoms: FulfillmentLineBom[];
};

export type FulfillmentResult = {
  orderCogs: Prisma.Decimal;
  consumedIngredientIds: string[];
};

@Injectable()
export class OrderFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeEngine: RecipeEngineService,
    private readonly fifo: FifoService,
    private readonly eightySix: EightySixService,
  ) {}

  async prepareFulfillment(order: OrderWithLines): Promise<FulfillmentPrep> {
    const existingSnapshots = await this.prisma.orderLineBomSnapshot.findMany({
      where: { orderLineId: { in: order.lines.map((line) => line.id) } },
      select: { orderLineId: true },
    });
    const fulfilledLineIds = new Set(existingSnapshots.map((snapshot) => snapshot.orderLineId));
    const pendingLines = order.lines.filter((line) => !fulfilledLineIds.has(line.id));

    const existingCogs =
      fulfilledLineIds.size > 0
        ? (
            await this.prisma.orderLine.findMany({
              where: { id: { in: Array.from(fulfilledLineIds) } },
              select: { lineCogs: true },
            })
          ).reduce((sum, line) => sum.add(line.lineCogs), new Prisma.Decimal(0))
        : new Prisma.Decimal(0);

    if (pendingLines.length === 0) {
      return { existingCogs, lineBoms: [] };
    }

    const lineBoms = await Promise.all(
      pendingLines.map(async (line) => {
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

    return { existingCogs, lineBoms };
  }

  async applyFulfillmentInTx(
    tx: Prisma.TransactionClient,
    order: OrderWithLines,
    userId: string,
    prep: FulfillmentPrep,
  ): Promise<FulfillmentResult> {
    const consumedIngredientIds = new Set<string>();
    let pendingCogs = new Prisma.Decimal(0);

    for (const { line, bom } of prep.lineBoms) {
      const consumption = await this.fifo.consume(
        tx,
        order.branchId,
        bom.lines,
        { type: 'order_line', id: line.id },
        userId,
      );

      pendingCogs = pendingCogs.add(consumption.totalCost);
      bom.lines.forEach((bomLine) => consumedIngredientIds.add(bomLine.ingredientId));

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
          (acc, allocation) => acc.add(allocation.extendedCost),
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

    return {
      orderCogs: prep.existingCogs.add(pendingCogs),
      consumedIngredientIds: Array.from(consumedIngredientIds),
    };
  }

  scheduleEightySixPropagation(branchId: string, ingredientIds: string[]) {
    if (!ingredientIds.length) return;
    void this.eightySix
      .propagateAfterConsumption(branchId, ingredientIds)
      .catch(() => undefined);
  }

  async fulfillOrder(order: OrderWithLines, userId: string): Promise<FulfillmentResult> {
    const prep = await this.prepareFulfillment(order);

    if (prep.lineBoms.length === 0) {
      return { orderCogs: prep.existingCogs, consumedIngredientIds: [] };
    }

    const result = await this.prisma.$transaction(
      (tx) => this.applyFulfillmentInTx(tx, order, userId, prep),
      PRISMA_TX_OPTIONS,
    );

    this.scheduleEightySixPropagation(order.branchId, result.consumedIngredientIds);
    return result;
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
}

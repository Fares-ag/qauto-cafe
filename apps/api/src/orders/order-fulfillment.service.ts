import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RecipeEngineService } from '../recipe/recipe-engine.service';
import { FifoService } from '../inventory/fifo.service';
import { EightySixService } from '../inventory/eighty-six.service';
import { InsufficientStockError, LayerAllocation } from '../inventory/inventory.types';
import { PRISMA_TX_OPTIONS } from '../prisma/transaction-options';

type OrderWithLines = {
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

@Injectable()
export class OrderFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recipeEngine: RecipeEngineService,
    private readonly fifo: FifoService,
    private readonly eightySix: EightySixService,
  ) {}

  async fulfillOrder(order: OrderWithLines, userId: string): Promise<{
    orderCogs: Prisma.Decimal;
    consumedIngredientIds: string[];
  }> {
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
    let orderCogs = new Prisma.Decimal(0);

    await this.prisma.$transaction(async (tx) => {
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
    }, PRISMA_TX_OPTIONS);

    void this.eightySix
      .propagateAfterConsumption(order.branchId, Array.from(consumedIngredientIds))
      .catch(() => undefined);

    return { orderCogs, consumedIngredientIds: Array.from(consumedIngredientIds) };
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

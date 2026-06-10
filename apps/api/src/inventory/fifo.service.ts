import { Injectable } from '@nestjs/common';
import { Prisma, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ConsumptionLineInput,
  ConsumptionResult,
  InsufficientStockError,
  LayerAllocation,
  StockShortage,
} from './inventory.types';

type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class FifoService {
  constructor(private readonly prisma: PrismaService) {}

  async checkAvailability(
    branchId: string,
    lines: ConsumptionLineInput[],
  ): Promise<StockShortage[]> {
    const aggregated = this.aggregateLines(lines);
    const shortages: StockShortage[] = [];

    for (const line of aggregated) {
      const available = await this.getAvailableQty(this.prisma, branchId, line.ingredientId);
      if (available.lt(line.quantity)) {
        shortages.push({
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          required: line.quantity.toFixed(4),
          available: available.toFixed(4),
          uom: line.uomCode,
        });
      }
    }

    return shortages;
  }

  async consume(
    tx: TransactionClient,
    branchId: string,
    lines: ConsumptionLineInput[],
    reference: { type: string; id: string },
    userId: string,
  ): Promise<ConsumptionResult> {
    const aggregated = this.aggregateLines(lines);
    const shortages = await this.checkAvailabilityInTx(tx, branchId, aggregated);

    if (shortages.length) {
      throw new InsufficientStockError(shortages);
    }

    const allocations: LayerAllocation[] = [];
    let totalCost = new Prisma.Decimal(0);

    for (const line of aggregated) {
      let remaining = line.quantity;

      const layers = await tx.stockLayer.findMany({
        where: {
          branchId,
          ingredientId: line.ingredientId,
          quantityRemaining: { gt: 0 },
        },
        orderBy: { receivedAt: 'asc' },
      });

      for (const layer of layers) {
        if (remaining.lte(0)) break;

        const take = remaining.lte(layer.quantityRemaining) ? remaining : layer.quantityRemaining;
        const extendedCost = take.mul(layer.unitCost);

        await tx.stockLayer.update({
          where: { id: layer.id },
          data: { quantityRemaining: layer.quantityRemaining.sub(take) },
        });

        await tx.stockMovement.create({
          data: {
            branchId,
            ingredientId: line.ingredientId,
            layerId: layer.id,
            type: StockMovementType.SALE,
            quantity: take.neg(),
            uomId: line.uomId,
            unitCost: layer.unitCost,
            extendedCost: extendedCost.neg(),
            referenceType: reference.type,
            referenceId: reference.id,
            createdById: userId,
          },
        });

        allocations.push({
          layerId: layer.id,
          ingredientId: line.ingredientId,
          quantity: take,
          unitCost: layer.unitCost,
          extendedCost,
        });

        totalCost = totalCost.add(extendedCost);
        remaining = remaining.sub(take);
      }
    }

    return { allocations, totalCost };
  }

  async reverseAllocations(
    tx: TransactionClient,
    branchId: string,
    allocations: LayerAllocation[],
    reference: { type: string; id: string },
    userId: string,
    movementType: StockMovementType = StockMovementType.VOID_REVERSAL,
  ) {
    for (const allocation of allocations) {
      const layer = await tx.stockLayer.findUnique({ where: { id: allocation.layerId } });
      const uomId = layer?.uomId ?? (await this.getIngredientUom(allocation.ingredientId));

      if (layer) {
        await tx.stockLayer.update({
          where: { id: layer.id },
          data: { quantityRemaining: layer.quantityRemaining.add(allocation.quantity) },
        });
      } else {
        await tx.stockLayer.create({
          data: {
            branchId,
            ingredientId: allocation.ingredientId,
            quantityRemaining: allocation.quantity,
            unitCost: allocation.unitCost,
            uomId,
            receivedAt: new Date(),
            sourceType: 'VOID_RESTOCK',
            sourceId: reference.id,
          },
        });
      }

      await tx.stockMovement.create({
        data: {
          branchId,
          ingredientId: allocation.ingredientId,
          layerId: allocation.layerId,
          type: movementType,
          quantity: allocation.quantity,
          uomId,
          unitCost: allocation.unitCost,
          extendedCost: allocation.extendedCost,
          referenceType: reference.type,
          referenceId: reference.id,
          createdById: userId,
        },
      });
    }
  }

  private async getIngredientUom(ingredientId: string) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id: ingredientId },
      select: { baseUomId: true },
    });
    return ingredient!.baseUomId;
  }

  private aggregateLines(lines: ConsumptionLineInput[]): ConsumptionLineInput[] {
    const map = new Map<string, ConsumptionLineInput>();

    for (const line of lines) {
      const key = `${line.ingredientId}:${line.uomId}`;
      const existing = map.get(key);
      if (existing) {
        existing.quantity = existing.quantity.add(line.quantity);
      } else {
        map.set(key, { ...line });
      }
    }

    return Array.from(map.values());
  }

  private async getAvailableQty(
    client: TransactionClient | PrismaService,
    branchId: string,
    ingredientId: string,
  ) {
    const result = await client.stockLayer.aggregate({
      where: { branchId, ingredientId, quantityRemaining: { gt: 0 } },
      _sum: { quantityRemaining: true },
    });

    return new Prisma.Decimal(result._sum.quantityRemaining ?? 0);
  }

  private async checkAvailabilityInTx(
    tx: TransactionClient,
    branchId: string,
    lines: ConsumptionLineInput[],
  ) {
    const shortages: StockShortage[] = [];

    for (const line of lines) {
      const available = await this.getAvailableQty(tx, branchId, line.ingredientId);
      if (available.lt(line.quantity)) {
        shortages.push({
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          required: line.quantity.toFixed(4),
          available: available.toFixed(4),
          uom: line.uomCode,
        });
      }
    }

    return shortages;
  }
}

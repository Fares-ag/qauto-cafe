import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, StockLayerSourceType, StockMovementType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FifoService } from './fifo.service';
import { EightySixService } from './eighty-six.service';
import { AuditService } from '../audit/audit.service';
import { InsufficientStockError } from './inventory.types';
import { AdjustStockDto, ReceiveStockDto, TransferStockDto, WasteStockDto } from './dto/inventory-ops.dto';
import { decimalToString } from '../common/utils/decimal.util';
import { UomConversionService } from './uom-conversion.service';

@Injectable()
export class InventoryOpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fifo: FifoService,
    private readonly eightySix: EightySixService,
    private readonly audit: AuditService,
    private readonly uom: UomConversionService,
  ) {}

  async receive(organizationId: string, userId: string, dto: ReceiveStockDto) {
    await this.assertBranch(organizationId, dto.branchId);
    const ingredient = await this.getIngredient(organizationId, dto.ingredientId);

    const inputUomId = dto.inputUomId ?? ingredient.baseUomId;
    const inputQty = new Prisma.Decimal(dto.quantity);
    const inputUnitCost = new Prisma.Decimal(dto.unitCost);

    if (inputQty.lte(0)) throw new BadRequestException('Quantity must be positive');
    if (inputUnitCost.lt(0)) throw new BadRequestException('Unit cost cannot be negative');

    const { baseQuantity: quantity, baseUomId } = await this.uom.convertToBase(
      dto.ingredientId,
      inputQty,
      inputUomId,
    );
    const unitCost = await this.uom.convertUnitCostToBase(dto.ingredientId, inputUnitCost, inputUomId);

    const layer = await this.prisma.$transaction(async (tx) => {
      const created = await tx.stockLayer.create({
        data: {
          branchId: dto.branchId,
          ingredientId: dto.ingredientId,
          quantityRemaining: quantity,
          unitCost,
          uomId: ingredient.baseUomId,
          receivedAt: new Date(),
          sourceType: StockLayerSourceType.PURCHASE_RECEIPT,
          notes: dto.notes,
        },
      });

      await tx.stockMovement.create({
        data: {
          branchId: dto.branchId,
          ingredientId: dto.ingredientId,
          layerId: created.id,
          type: StockMovementType.RECEIPT,
          quantity,
          uomId: ingredient.baseUomId,
          unitCost,
          extendedCost: quantity.mul(unitCost),
          referenceType: 'stock_receive',
          referenceId: created.id,
          notes: dto.notes,
          createdById: userId,
        },
      });

      return created;
    });

    await this.eightySix.propagateAfterRestock(dto.branchId, dto.ingredientId);

    await this.audit.log({
      organizationId,
      branchId: dto.branchId,
      userId,
      action: 'STOCK_RECEIVE',
      entityType: 'stock_layer',
      entityId: layer.id,
      afterState: {
        ingredientId: dto.ingredientId,
        quantity: dto.quantity,
        unitCost: dto.unitCost,
      },
    });

    return {
      layerId: layer.id,
      ingredientId: dto.ingredientId,
      quantity: dto.quantity,
      unitCost: dto.unitCost,
    };
  }

  async waste(organizationId: string, userId: string, dto: WasteStockDto) {
    await this.assertBranch(organizationId, dto.branchId);
    const ingredient = await this.getIngredient(organizationId, dto.ingredientId);

    const inputUomId = dto.inputUomId ?? ingredient.baseUomId;
    const inputQty = new Prisma.Decimal(dto.quantity);
    if (inputQty.lte(0)) throw new BadRequestException('Quantity must be positive');

    const { baseQuantity: quantity } = await this.uom.convertToBase(
      dto.ingredientId,
      inputQty,
      inputUomId,
    );

    const shortages = await this.fifo.checkAvailability(dto.branchId, [
      {
        ingredientId: dto.ingredientId,
        ingredientName: ingredient.name,
        quantity,
        uomId: ingredient.baseUomId,
        uomCode: ingredient.baseUom.code,
      },
    ]);

    if (shortages.length) throw new InsufficientStockError(shortages);

    const wasteRecord = await this.prisma.$transaction(async (tx) => {
      let remaining = quantity;
      const layers = await tx.stockLayer.findMany({
        where: {
          branchId: dto.branchId,
          ingredientId: dto.ingredientId,
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
            branchId: dto.branchId,
            ingredientId: dto.ingredientId,
            layerId: layer.id,
            type: StockMovementType.WASTE,
            quantity: take.neg(),
            uomId: ingredient.baseUomId,
            unitCost: layer.unitCost,
            extendedCost: extendedCost.neg(),
            referenceType: 'waste_record',
            notes: dto.reason,
            createdById: userId,
          },
        });

        remaining = remaining.sub(take);
      }

      return tx.wasteRecord.create({
        data: {
          branchId: dto.branchId,
          ingredientId: dto.ingredientId,
          quantity,
          reason: dto.reason,
          notes: dto.notes,
          recordedById: userId,
        },
      });
    });

    await this.eightySix.propagateAfterConsumption(dto.branchId, [dto.ingredientId]);

    await this.audit.log({
      organizationId,
      branchId: dto.branchId,
      userId,
      action: 'STOCK_ADJUST',
      entityType: 'waste_record',
      entityId: wasteRecord.id,
      afterState: { ingredientId: dto.ingredientId, quantity: dto.quantity, reason: dto.reason },
    });

    return { wasteRecordId: wasteRecord.id, quantity: dto.quantity };
  }

  async adjust(organizationId: string, userId: string, dto: AdjustStockDto) {
    await this.assertBranch(organizationId, dto.branchId);
    const ingredient = await this.getIngredient(organizationId, dto.ingredientId);

    const delta = new Prisma.Decimal(dto.quantityDelta);
    if (delta.eq(0)) throw new BadRequestException('Adjustment quantity cannot be zero');

    if (delta.gt(0)) {
      const unitCost = new Prisma.Decimal(dto.unitCost ?? '0');
      if (unitCost.lt(0)) throw new BadRequestException('Unit cost cannot be negative');

      const layer = await this.prisma.$transaction(async (tx) => {
        const created = await tx.stockLayer.create({
          data: {
            branchId: dto.branchId,
            ingredientId: dto.ingredientId,
            quantityRemaining: delta,
            unitCost,
            uomId: ingredient.baseUomId,
            receivedAt: new Date(),
            sourceType: StockLayerSourceType.ADJUSTMENT,
            notes: dto.reason,
          },
        });

        await tx.stockMovement.create({
          data: {
            branchId: dto.branchId,
            ingredientId: dto.ingredientId,
            layerId: created.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: delta,
            uomId: ingredient.baseUomId,
            unitCost,
            extendedCost: delta.mul(unitCost),
            referenceType: 'stock_adjustment',
            referenceId: created.id,
            notes: dto.reason,
            createdById: userId,
          },
        });

        return created;
      });

      await this.eightySix.propagateAfterRestock(dto.branchId, dto.ingredientId);

      await this.audit.log({
        organizationId,
        branchId: dto.branchId,
        userId,
        action: 'STOCK_ADJUST',
        entityType: 'stock_layer',
        entityId: layer.id,
        afterState: { delta: dto.quantityDelta, reason: dto.reason },
      });

      return { layerId: layer.id, quantityDelta: dto.quantityDelta };
    }

    const absQty = delta.abs();
    const shortages = await this.fifo.checkAvailability(dto.branchId, [
      {
        ingredientId: dto.ingredientId,
        ingredientName: ingredient.name,
        quantity: absQty,
        uomId: ingredient.baseUomId,
        uomCode: ingredient.baseUom.code,
      },
    ]);

    if (shortages.length) throw new InsufficientStockError(shortages);

    await this.prisma.$transaction(async (tx) => {
      let remaining = absQty;
      const layers = await tx.stockLayer.findMany({
        where: {
          branchId: dto.branchId,
          ingredientId: dto.ingredientId,
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
            branchId: dto.branchId,
            ingredientId: dto.ingredientId,
            layerId: layer.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: take.neg(),
            uomId: ingredient.baseUomId,
            unitCost: layer.unitCost,
            extendedCost: extendedCost.neg(),
            referenceType: 'stock_adjustment',
            notes: dto.reason,
            createdById: userId,
          },
        });

        remaining = remaining.sub(take);
      }
    });

    await this.eightySix.propagateAfterConsumption(dto.branchId, [dto.ingredientId]);

    await this.audit.log({
      organizationId,
      branchId: dto.branchId,
      userId,
      action: 'STOCK_ADJUST',
      entityType: 'ingredient',
      entityId: dto.ingredientId,
      afterState: { delta: dto.quantityDelta, reason: dto.reason },
    });

    return { quantityDelta: dto.quantityDelta };
  }

  async transfer(organizationId: string, userId: string, dto: TransferStockDto) {
    if (dto.fromBranchId === dto.toBranchId) {
      throw new BadRequestException('Source and destination branches must differ');
    }

    await this.assertBranch(organizationId, dto.fromBranchId);
    await this.assertBranch(organizationId, dto.toBranchId);
    const ingredient = await this.getIngredient(organizationId, dto.ingredientId);

    const inputUomId = dto.inputUomId ?? ingredient.baseUomId;
    const inputQty = new Prisma.Decimal(dto.quantity);
    if (inputQty.lte(0)) throw new BadRequestException('Quantity must be positive');

    const { baseQuantity: quantity } = await this.uom.convertToBase(
      dto.ingredientId,
      inputQty,
      inputUomId,
    );

    const shortages = await this.fifo.checkAvailability(dto.fromBranchId, [
      {
        ingredientId: dto.ingredientId,
        ingredientName: ingredient.name,
        quantity,
        uomId: ingredient.baseUomId,
        uomCode: ingredient.baseUom.code,
      },
    ]);
    if (shortages.length) throw new InsufficientStockError(shortages);

    const transferId = await this.prisma.$transaction(async (tx) => {
      let remaining = quantity;
      let totalCost = new Prisma.Decimal(0);
      const layers = await tx.stockLayer.findMany({
        where: {
          branchId: dto.fromBranchId,
          ingredientId: dto.ingredientId,
          quantityRemaining: { gt: 0 },
        },
        orderBy: { receivedAt: 'asc' },
      });

      const refId = `transfer-${Date.now()}`;

      for (const layer of layers) {
        if (remaining.lte(0)) break;
        const take = remaining.lte(layer.quantityRemaining) ? remaining : layer.quantityRemaining;
        const extendedCost = take.mul(layer.unitCost);
        totalCost = totalCost.add(extendedCost);

        await tx.stockLayer.update({
          where: { id: layer.id },
          data: { quantityRemaining: layer.quantityRemaining.sub(take) },
        });

        await tx.stockMovement.create({
          data: {
            branchId: dto.fromBranchId,
            ingredientId: dto.ingredientId,
            layerId: layer.id,
            type: StockMovementType.TRANSFER_OUT,
            quantity: take.neg(),
            uomId: ingredient.baseUomId,
            unitCost: layer.unitCost,
            extendedCost: extendedCost.neg(),
            referenceType: 'inventory_transfer',
            referenceId: refId,
            notes: dto.notes,
            createdById: userId,
          },
        });

        const destLayer = await tx.stockLayer.create({
          data: {
            branchId: dto.toBranchId,
            ingredientId: dto.ingredientId,
            quantityRemaining: take,
            unitCost: layer.unitCost,
            uomId: ingredient.baseUomId,
            receivedAt: new Date(),
            sourceType: StockLayerSourceType.TRANSFER,
            notes: dto.notes,
          },
        });

        await tx.stockMovement.create({
          data: {
            branchId: dto.toBranchId,
            ingredientId: dto.ingredientId,
            layerId: destLayer.id,
            type: StockMovementType.TRANSFER_IN,
            quantity: take,
            uomId: ingredient.baseUomId,
            unitCost: layer.unitCost,
            extendedCost,
            referenceType: 'inventory_transfer',
            referenceId: refId,
            notes: dto.notes,
            createdById: userId,
          },
        });

        remaining = remaining.sub(take);
      }

      return refId;
    });

    await this.eightySix.propagateAfterConsumption(dto.fromBranchId, [dto.ingredientId]);
    await this.eightySix.propagateAfterRestock(dto.toBranchId, dto.ingredientId);

    await this.audit.log({
      organizationId,
      branchId: dto.fromBranchId,
      userId,
      action: 'STOCK_ADJUST',
      entityType: 'inventory_transfer',
      entityId: transferId,
      afterState: {
        fromBranchId: dto.fromBranchId,
        toBranchId: dto.toBranchId,
        ingredientId: dto.ingredientId,
        quantity: dto.quantity,
      },
    });

    return {
      transferId,
      fromBranchId: dto.fromBranchId,
      toBranchId: dto.toBranchId,
      ingredientId: dto.ingredientId,
      quantity: dto.quantity,
    };
  }

  async getLowStock(organizationId: string, branchId: string) {
    await this.assertBranch(organizationId, branchId);

    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        trackStock: true,
        isPackaging: false,
        reorderPoint: { not: null },
      },
      include: { baseUom: true },
      orderBy: { name: 'asc' },
    });

    if (ingredients.length === 0) {
      return { branchId, items: [] };
    }

    const ingredientIds = ingredients.map((i) => i.id);
    const stockTotals = await this.prisma.stockLayer.groupBy({
      by: ['ingredientId'],
      where: {
        branchId,
        ingredientId: { in: ingredientIds },
        quantityRemaining: { gt: 0 },
      },
      _sum: { quantityRemaining: true },
    });

    const availableByIngredient = new Map(
      stockTotals.map((row) => [row.ingredientId, row._sum.quantityRemaining ?? new Prisma.Decimal(0)]),
    );

    const items = ingredients.map((ingredient) => {
      const available = availableByIngredient.get(ingredient.id) ?? new Prisma.Decimal(0);
      const reorderPoint = ingredient.reorderPoint ?? new Prisma.Decimal(0);
      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        code: ingredient.code,
        available: decimalToString(available),
        reorderPoint: decimalToString(reorderPoint),
        uom: ingredient.baseUom.code,
        isLow: available.lt(reorderPoint),
      };
    });

    return {
      branchId,
      items: items.filter((i) => i.isLow),
    };
  }

  async listMovements(
    organizationId: string,
    branchId: string,
    query: { ingredientId?: string; limit?: number },
  ) {
    await this.assertBranch(organizationId, branchId);
    const limit = Math.min(query.limit ?? 50, 100);

    const rows = await this.prisma.stockMovement.findMany({
      where: {
        branchId,
        ...(query.ingredientId ? { ingredientId: query.ingredientId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        ingredient: { select: { id: true, name: true, code: true } },
        uom: { select: { code: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      ingredientId: row.ingredientId,
      ingredientName: row.ingredient.name,
      quantity: decimalToString(row.quantity),
      uom: row.uom.code,
      unitCost: decimalToString(row.unitCost),
      extendedCost: decimalToString(row.extendedCost),
      notes: row.notes,
      createdByName: row.createdBy
        ? `${row.createdBy.firstName} ${row.createdBy.lastName}`
        : null,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async assertBranch(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Branch not found');
  }

  private async getIngredient(organizationId: string, ingredientId: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id: ingredientId, organizationId, deletedAt: null },
      include: { baseUom: true },
    });
    if (!ingredient) throw new NotFoundException('Ingredient not found');
    return ingredient;
  }
}

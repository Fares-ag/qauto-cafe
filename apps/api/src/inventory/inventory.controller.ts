import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CacheService } from '../cache/cache.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { decimalToString } from '../common/utils/decimal.util';
import { InventoryOpsService } from './inventory-ops.service';
import { UomConversionService } from './uom-conversion.service';
import { AdjustStockDto, ReceiveStockDto, TransferStockDto, WasteStockDto } from './dto/inventory-ops.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { BranchAccessService } from '../common/services/branch-access.service';

const STOCK_CACHE_TTL_SECONDS = 30;

export function inventoryStockCacheKey(branchId: string) {
  return `inventory:stock:${branchId}`;
}

@Controller('inventory')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
export class InventoryController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryOps: InventoryOpsService,
    private readonly branchAccess: BranchAccessService,
    private readonly uom: UomConversionService,
    private readonly cache: CacheService,
  ) {}

  @Get('uoms')
  @Permissions('stock.view', 'ingredient.view', 'inventory.manage')
  listUoms() {
    return this.uom.listUoms();
  }

  @Get('stock')
  @Permissions('stock.view', 'inventory.manage')
  async getStock(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    await this.branchAccess.assertUserBranchAccess(user, branchId);

    const cacheKey = inventoryStockCacheKey(branchId);
    type StockResponse = Awaited<ReturnType<InventoryController['buildStock']>>;
    const cached = await this.cache.get<StockResponse>(cacheKey);
    if (cached) return cached;

    const result = await this.buildStock(user.organizationId, branchId);
    await this.cache.set(cacheKey, result, STOCK_CACHE_TTL_SECONDS);
    return result;
  }

  private async buildStock(organizationId: string, branchId: string) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null,
        trackStock: true,
      },
      include: { baseUom: true, purchaseUom: true },
      orderBy: { name: 'asc' },
    });

    const layers = await this.prisma.stockLayer.groupBy({
      by: ['ingredientId'],
      where: {
        branchId,
        quantityRemaining: { gt: 0 },
        ingredient: { organizationId },
      },
      _sum: { quantityRemaining: true },
    });

    // Weighted value: re-fetch per-ingredient extended cost via aggregate query
    const valueRows = await this.prisma.$queryRaw<
      Array<{ ingredient_id: string; total_value: Prisma.Decimal }>
    >`
      SELECT ingredient_id, SUM(quantity_remaining * unit_cost) AS total_value
      FROM stock_layers
      WHERE branch_id = ${branchId} AND quantity_remaining > 0
      GROUP BY ingredient_id
    `;
    const valueByIngredient = new Map(
      valueRows.map((r) => [r.ingredient_id, new Prisma.Decimal(r.total_value ?? 0)]),
    );

    const stats = new Map<string, { qty: Prisma.Decimal; value: Prisma.Decimal }>();
    for (const row of layers) {
      const qty = row._sum.quantityRemaining ?? new Prisma.Decimal(0);
      stats.set(row.ingredientId, {
        qty,
        value: valueByIngredient.get(row.ingredientId) ?? new Prisma.Decimal(0),
      });
    }

    let totalValueQar = new Prisma.Decimal(0);
    const items = ingredients.map((ingredient) => {
      const stat = stats.get(ingredient.id) ?? { qty: new Prisma.Decimal(0), value: new Prisma.Decimal(0) };
      totalValueQar = totalValueQar.add(stat.value);
      const reorderPoint = ingredient.reorderPoint;
      const isLow =
        reorderPoint != null && stat.qty.lt(reorderPoint) && !ingredient.isPackaging;

      return {
        ingredientId: ingredient.id,
        name: ingredient.name,
        code: ingredient.code,
        isPackaging: ingredient.isPackaging,
        available: decimalToString(stat.qty),
        uom: ingredient.baseUom.code,
        uomId: ingredient.baseUomId,
        purchaseUom: ingredient.purchaseUom?.code ?? null,
        purchaseUomId: ingredient.purchaseUomId,
        reorderPoint: reorderPoint != null ? decimalToString(reorderPoint) : null,
        parLevel: ingredient.parLevel != null ? decimalToString(ingredient.parLevel) : null,
        valueOnHandQar: decimalToString(stat.value),
        isLow,
      };
    });

    return {
      branchId,
      totalValueQar: decimalToString(totalValueQar),
      items,
    };
  }

  @Get('ingredients')
  @Permissions('ingredient.view', 'stock.view')
  async listIngredients(@CurrentUser() user: AuthenticatedUser) {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },
      include: { baseUom: true, purchaseUom: true },
      orderBy: { name: 'asc' },
    });

    return ingredients.map((i) => ({
      id: i.id,
      name: i.name,
      code: i.code,
      trackStock: i.trackStock,
      uom: i.baseUom.code,
      uomId: i.baseUomId,
      purchaseUom: i.purchaseUom?.code ?? null,
      purchaseUomId: i.purchaseUomId,
      reorderPoint: i.reorderPoint != null ? decimalToString(i.reorderPoint) : null,
    }));
  }

  @Get('movements')
  @Permissions('stock.view', 'inventory.manage')
  listMovements(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('ingredientId') ingredientId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.inventoryOps.listMovements(user.organizationId, branchId, {
      ingredientId,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
  }

  @Post('receive')
  @Permissions('stock.receive', 'inventory.manage')
  async receive(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReceiveStockDto) {
    const result = await this.inventoryOps.receive(user.organizationId, user.id, dto);
    await this.cache.del(inventoryStockCacheKey(dto.branchId));
    return result;
  }

  @Post('waste')
  @Permissions('stock.waste', 'inventory.manage')
  async waste(@CurrentUser() user: AuthenticatedUser, @Body() dto: WasteStockDto) {
    const result = await this.inventoryOps.waste(user.organizationId, user.id, dto);
    await this.cache.del(inventoryStockCacheKey(dto.branchId));
    return result;
  }

  @Post('adjust')
  @Permissions('stock.adjust', 'inventory.manage')
  async adjust(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdjustStockDto) {
    const result = await this.inventoryOps.adjust(user.organizationId, user.id, dto);
    await this.cache.del(inventoryStockCacheKey(dto.branchId));
    return result;
  }

  @Post('transfer')
  @Permissions('inventory.manage')
  async transfer(@CurrentUser() user: AuthenticatedUser, @Body() dto: TransferStockDto) {
    const result = await this.inventoryOps.transfer(user.organizationId, user.id, dto);
    await Promise.all([
      this.cache.del(inventoryStockCacheKey(dto.fromBranchId)),
      this.cache.del(inventoryStockCacheKey(dto.toBranchId)),
    ]);
    return result;
  }

  @Get('low-stock')
  @Permissions('stock.view', 'inventory.manage')
  getLowStock(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.inventoryOps.getLowStock(user.organizationId, branchId);
  }
}

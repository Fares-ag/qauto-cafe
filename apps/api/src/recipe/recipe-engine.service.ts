import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ModifierAction, Prisma, RecipeStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FifoService } from '../inventory/fifo.service';
import { UomConversionService } from '../inventory/uom-conversion.service';
import { ResolveBomInput, ResolvedBomLine } from './recipe.types';

@Injectable()
export class RecipeEngineService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fifo: FifoService,
    private readonly uom: UomConversionService,
  ) {}

  async resolveBom(input: ResolveBomInput): Promise<{
    lines: ResolvedBomLine[];
    recipeId: string | null;
    recipeVersion: number | null;
  }> {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: input.menuItemId, isActive: true, deletedAt: null },
      include: { snackIngredient: { include: { baseUom: true } } },
    });

    if (!item) {
      throw new NotFoundException(`Menu item not found: ${input.menuItemId}`);
    }

    if (item.type === 'SNACK') {
      if (!item.snackIngredientId || !item.snackIngredient) {
        throw new BadRequestException(`Snack ${item.name} has no linked ingredient SKU`);
      }

      if (!item.snackIngredient.trackStock) {
        return { lines: [], recipeId: null, recipeVersion: null };
      }

      const line: ResolvedBomLine = {
        ingredientId: item.snackIngredient.id,
        ingredientName: item.snackIngredient.name,
        quantity: new Prisma.Decimal(input.quantity),
        uomId: item.snackIngredient.baseUomId,
        uomCode: item.snackIngredient.baseUom.code,
      };

      return { lines: [await this.normalizeLine(line)], recipeId: null, recipeVersion: null };
    }

    const recipe = await this.prisma.recipe.findFirst({
      where: {
        menuItemId: input.menuItemId,
        sizeId: input.sizeId ?? undefined,
        status: RecipeStatus.APPROVED,
        deletedAt: null,
        effectiveFrom: { lte: new Date() },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      include: {
        lines: {
          include: {
            ingredient: { include: { baseUom: true } },
            uom: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new BadRequestException(
        `No approved recipe for ${item.name}. Configure recipe before selling.`,
      );
    }

    let bomLines: ResolvedBomLine[] = recipe.lines
      .filter((line) => !line.isOptional)
      .filter((line) => line.ingredient.trackStock)
      .map((line) => ({
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        quantity: line.quantity,
        uomId: line.uomId,
        uomCode: line.uom.code,
      }));

    if (input.modifierIds.length) {
      const rules = await this.prisma.modifierBomRule.findMany({
        where: { modifierId: { in: input.modifierIds } },
        orderBy: [{ modifierId: 'asc' }, { priority: 'asc' }],
        include: {
          targetIngredient: { include: { baseUom: true } },
          replacementIngredient: { include: { baseUom: true } },
          uom: true,
        },
      });

      for (const rule of rules) {
        bomLines = this.applyRule(bomLines, rule);
      }
    }

    const merged = this.mergeLines(bomLines);
    const scaled = merged.map((line) => ({
      ...line,
      quantity: line.quantity.mul(input.quantity),
    }));

    const normalized = await Promise.all(scaled.map((line) => this.normalizeLine(line)));

    return {
      lines: normalized,
      recipeId: recipe.id,
      recipeVersion: recipe.version,
    };
  }

  async simulate(input: ResolveBomInput & { branchId: string }) {
    const resolved = await this.resolveBom(input);
    const availability = await Promise.all(
      resolved.lines.map(async (line) => {
        const available = await this.getAvailableQty(input.branchId, line.ingredientId);
        return {
          ingredientId: line.ingredientId,
          ingredientName: line.ingredientName,
          quantity: line.quantity.toFixed(4),
          available: available.toFixed(4),
          uom: line.uomCode,
          sufficient: available.gte(line.quantity),
        };
      }),
    );

    let totalCogsEstimate = new Prisma.Decimal(0);
    for (const line of resolved.lines) {
      totalCogsEstimate = totalCogsEstimate.add(
        await this.fifo.estimateLineCost(input.branchId, line.ingredientId, line.quantity),
      );
    }

    return {
      lines: availability,
      allSufficient: availability.every((l) => l.sufficient),
      totalCogsEstimate: totalCogsEstimate.toFixed(2),
      recipeId: resolved.recipeId,
      recipeVersion: resolved.recipeVersion,
    };
  }

  private async normalizeLine(line: ResolvedBomLine): Promise<ResolvedBomLine> {
    const converted = await this.uom.convertToBase(line.ingredientId, line.quantity, line.uomId);
    return {
      ingredientId: line.ingredientId,
      ingredientName: line.ingredientName,
      quantity: converted.baseQuantity,
      uomId: converted.baseUomId,
      uomCode: converted.baseUomCode,
    };
  }

  private applyRule(
    lines: ResolvedBomLine[],
    rule: {
      action: ModifierAction;
      targetIngredientId: string | null;
      replacementIngredientId: string | null;
      quantity: Prisma.Decimal | null;
      uomId: string | null;
      scaleFactor: Prisma.Decimal | null;
      replacementIngredient: {
        id: string;
        name: string;
        baseUomId: string;
        baseUom: { code: string };
        trackStock: boolean;
      } | null;
      uom: { id: string; code: string } | null;
    },
  ): ResolvedBomLine[] {
    switch (rule.action) {
      case ModifierAction.REPLACE: {
        if (!rule.targetIngredientId || !rule.replacementIngredient) return lines;
        if (!rule.replacementIngredient.trackStock) {
          return lines.filter((l) => l.ingredientId !== rule.targetIngredientId);
        }
        const targetQty = lines
          .filter((l) => l.ingredientId === rule.targetIngredientId)
          .reduce((acc, l) => acc.add(l.quantity), new Prisma.Decimal(0));

        const withoutTarget = lines.filter((l) => l.ingredientId !== rule.targetIngredientId);
        if (targetQty.lte(0)) return lines;

        return [
          ...withoutTarget,
          {
            ingredientId: rule.replacementIngredient.id,
            ingredientName: rule.replacementIngredient.name,
            quantity: targetQty,
            uomId: rule.replacementIngredient.baseUomId,
            uomCode: rule.replacementIngredient.baseUom.code,
          },
        ];
      }
      case ModifierAction.ADD: {
        if (
          !rule.replacementIngredientId ||
          !rule.replacementIngredient ||
          !rule.replacementIngredient.trackStock ||
          !rule.quantity ||
          !rule.uom
        ) {
          return lines;
        }
        return [
          ...lines,
          {
            ingredientId: rule.replacementIngredient.id,
            ingredientName: rule.replacementIngredient.name,
            quantity: rule.quantity,
            uomId: rule.uom.id,
            uomCode: rule.uom.code,
          },
        ];
      }
      case ModifierAction.REMOVE: {
        if (!rule.targetIngredientId) return lines;
        return lines.filter((l) => l.ingredientId !== rule.targetIngredientId);
      }
      case ModifierAction.SCALE: {
        if (!rule.scaleFactor) return lines;
        return lines.map((l) => ({
          ...l,
          quantity: l.quantity.mul(rule.scaleFactor!),
        }));
      }
      case ModifierAction.SWAP: {
        if (
          !rule.targetIngredientId ||
          !rule.replacementIngredient ||
          !rule.replacementIngredient.trackStock
        ) {
          return lines;
        }
        const targetQty = lines
          .filter((l) => l.ingredientId === rule.targetIngredientId)
          .reduce((acc, l) => acc.add(l.quantity), new Prisma.Decimal(0));
        const withoutTarget = lines.filter((l) => l.ingredientId !== rule.targetIngredientId);
        if (targetQty.lte(0)) return lines;
        return [
          ...withoutTarget,
          {
            ingredientId: rule.replacementIngredient.id,
            ingredientName: rule.replacementIngredient.name,
            quantity: targetQty,
            uomId: rule.replacementIngredient.baseUomId,
            uomCode: rule.replacementIngredient.baseUom.code,
          },
        ];
      }
      default:
        return lines;
    }
  }

  private mergeLines(lines: ResolvedBomLine[]): ResolvedBomLine[] {
    const map = new Map<string, ResolvedBomLine>();

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

  private async getAvailableQty(branchId: string, ingredientId: string) {
    const result = await this.prisma.stockLayer.aggregate({
      where: { branchId, ingredientId, quantityRemaining: { gt: 0 } },
      _sum: { quantityRemaining: true },
    });

    return new Prisma.Decimal(result._sum.quantityRemaining ?? 0);
  }
}

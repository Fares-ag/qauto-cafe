import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface NormalizedQuantity {
  baseQuantity: Prisma.Decimal;
  baseUomId: string;
  baseUomCode: string;
}

@Injectable()
export class UomConversionService {
  constructor(private readonly prisma: PrismaService) {}

  async convertToBase(
    ingredientId: string,
    quantity: Prisma.Decimal,
    fromUomId: string,
  ): Promise<NormalizedQuantity> {
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({
      where: { id: ingredientId },
      include: { baseUom: true },
    });

    if (fromUomId === ingredient.baseUomId) {
      return {
        baseQuantity: quantity,
        baseUomId: ingredient.baseUomId,
        baseUomCode: ingredient.baseUom.code,
      };
    }

    const factor = await this.resolveFactor(ingredientId, fromUomId, ingredient.baseUomId, {
      purchaseUomId: ingredient.purchaseUomId,
      purchaseToBaseFactor: ingredient.purchaseToBaseFactor,
    });

    return {
      baseQuantity: quantity.mul(factor),
      baseUomId: ingredient.baseUomId,
      baseUomCode: ingredient.baseUom.code,
    };
  }

  async convertUnitCostToBase(
    ingredientId: string,
    unitCost: Prisma.Decimal,
    fromUomId: string,
  ): Promise<Prisma.Decimal> {
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({
      where: { id: ingredientId },
      select: { baseUomId: true, purchaseUomId: true, purchaseToBaseFactor: true },
    });

    if (fromUomId === ingredient.baseUomId) {
      return unitCost;
    }

    const factor = await this.resolveFactor(ingredientId, fromUomId, ingredient.baseUomId, {
      purchaseUomId: ingredient.purchaseUomId,
      purchaseToBaseFactor: ingredient.purchaseToBaseFactor,
    });

    if (factor.lte(0)) {
      throw new BadRequestException('Invalid UOM conversion factor');
    }

    return unitCost.div(factor);
  }

  async assertConvertible(ingredientId: string, fromUomId: string): Promise<void> {
    const ingredient = await this.prisma.ingredient.findUniqueOrThrow({
      where: { id: ingredientId },
      select: { baseUomId: true, purchaseUomId: true, purchaseToBaseFactor: true },
    });

    if (fromUomId === ingredient.baseUomId) {
      return;
    }

    await this.resolveFactor(ingredientId, fromUomId, ingredient.baseUomId, {
      purchaseUomId: ingredient.purchaseUomId,
      purchaseToBaseFactor: ingredient.purchaseToBaseFactor,
    });
  }

  listUoms() {
    return this.prisma.uom.findMany({
      orderBy: { code: 'asc' },
      select: { id: true, code: true, name: true, symbol: true },
    });
  }

  private async resolveFactor(
    ingredientId: string,
    fromUomId: string,
    baseUomId: string,
    purchase: {
      purchaseUomId: string | null;
      purchaseToBaseFactor: Prisma.Decimal | null;
    },
  ): Promise<Prisma.Decimal> {
    if (fromUomId === baseUomId) {
      return new Prisma.Decimal(1);
    }

    if (
      purchase.purchaseUomId === fromUomId &&
      purchase.purchaseToBaseFactor &&
      purchase.purchaseToBaseFactor.gt(0)
    ) {
      return purchase.purchaseToBaseFactor;
    }

    const direct = await this.findConversion(fromUomId, baseUomId, ingredientId);
    if (direct) {
      return direct;
    }

    const globalDirect = await this.findConversion(fromUomId, baseUomId, null);
    if (globalDirect) {
      return globalDirect;
    }

    const inverse = await this.findConversion(baseUomId, fromUomId, ingredientId);
    if (inverse && inverse.gt(0)) {
      return new Prisma.Decimal(1).div(inverse);
    }

    const globalInverse = await this.findConversion(baseUomId, fromUomId, null);
    if (globalInverse && globalInverse.gt(0)) {
      return new Prisma.Decimal(1).div(globalInverse);
    }

    const from = await this.prisma.uom.findUnique({ where: { id: fromUomId }, select: { code: true } });
    const base = await this.prisma.uom.findUnique({ where: { id: baseUomId }, select: { code: true } });
    throw new BadRequestException(
      `No UOM conversion from ${from?.code ?? fromUomId} to base ${base?.code ?? baseUomId} for this ingredient`,
    );
  }

  private async findConversion(
    fromUomId: string,
    toUomId: string,
    ingredientId: string | null,
  ): Promise<Prisma.Decimal | null> {
    const specific = ingredientId
      ? await this.prisma.uomConversion.findFirst({
          where: { fromUomId, toUomId, ingredientId },
        })
      : null;

    if (specific) {
      return specific.factor;
    }

    if (ingredientId !== null) {
      const global = await this.prisma.uomConversion.findFirst({
        where: { fromUomId, toUomId, ingredientId: null },
      });
      return global?.factor ?? null;
    }

    return null;
  }
}

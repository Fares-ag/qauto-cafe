import { ConflictException, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decimalToString } from '../common/utils/decimal.util';
import {
  CreateIngredientCategoryDto,
  CreateIngredientDto,
  UpdateIngredientCategoryDto,
  UpdateIngredientDto,
} from './dto/ingredient.dto';

@Injectable()
export class IngredientsAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  listCategories(organizationId: string) {
    return this.prisma.ingredientCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { ingredients: true } } },
    }).then((rows) =>
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        ingredientCount: c._count.ingredients,
      })),
    );
  }

  async createCategory(organizationId: string, userId: string, dto: CreateIngredientCategoryDto) {
    const category = await this.prisma.ingredientCategory.create({
      data: { organizationId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'ingredient_category',
      entityId: category.id,
      afterState: { name: dto.name },
    });
    return { id: category.id, name: category.name, sortOrder: category.sortOrder };
  }

  async updateCategory(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateIngredientCategoryDto,
  ) {
    const existing = await this.assertCategory(organizationId, id);
    const updated = await this.prisma.ingredientCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'ingredient_category',
      entityId: id,
      beforeState: { name: existing.name },
      afterState: { name: updated.name },
    });
    return { id: updated.id, name: updated.name, sortOrder: updated.sortOrder };
  }

  async removeCategory(organizationId: string, userId: string, id: string) {
    await this.assertCategory(organizationId, id);
    await this.prisma.ingredientCategory.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'ingredient_category',
      entityId: id,
    });
    return { id, deleted: true };
  }

  listIngredients(organizationId: string) {
    return this.prisma.ingredient.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { name: 'asc' },
      include: {
        category: { select: { id: true, name: true } },
        baseUom: { select: { id: true, code: true, symbol: true } },
      },
    }).then((rows) => rows.map((i) => this.serializeIngredient(i)));
  }

  async createIngredient(organizationId: string, userId: string, dto: CreateIngredientDto) {
    const dup = await this.prisma.ingredient.findFirst({
      where: { organizationId, code: dto.code, deletedAt: null },
    });
    if (dup) throw new ConflictException('Ingredient code already exists');

    let baseUomId = dto.baseUomId;
    if (!baseUomId && dto.baseUomCode) {
      const uom = await this.prisma.uom.findUnique({ where: { code: dto.baseUomCode } });
      if (!uom) throw new NotFoundException(`UOM not found: ${dto.baseUomCode}`);
      baseUomId = uom.id;
    }
    if (!baseUomId) {
      throw new BadRequestException('baseUomId or baseUomCode is required');
    }

    const ingredient = await this.prisma.ingredient.create({
      data: {
        organizationId,
        name: dto.name,
        code: dto.code,
        baseUomId,
        categoryId: dto.categoryId,
        description: dto.description,
        purchaseUomId: dto.purchaseUomId,
        purchaseToBaseFactor: dto.purchaseToBaseFactor,
        isPackaging: dto.isPackaging ?? false,
        trackStock: dto.trackStock ?? true,
        parLevel: dto.parLevel,
        reorderPoint: dto.reorderPoint,
      },
      include: {
        category: { select: { id: true, name: true } },
        baseUom: { select: { id: true, code: true, symbol: true } },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'ingredient',
      entityId: ingredient.id,
      afterState: { name: dto.name, code: dto.code },
    });

    return this.serializeIngredient(ingredient);
  }

  async updateIngredient(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateIngredientDto,
  ) {
    const existing = await this.assertIngredient(organizationId, id);
    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.trackStock !== undefined ? { trackStock: dto.trackStock } : {}),
        ...(dto.parLevel !== undefined ? { parLevel: dto.parLevel } : {}),
        ...(dto.reorderPoint !== undefined ? { reorderPoint: dto.reorderPoint } : {}),
      },
      include: {
        category: { select: { id: true, name: true } },
        baseUom: { select: { id: true, code: true, symbol: true } },
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'ingredient',
      entityId: id,
      beforeState: { reorderPoint: existing.reorderPoint?.toString() },
      afterState: { reorderPoint: updated.reorderPoint?.toString() },
    });

    return this.serializeIngredient(updated);
  }

  async removeIngredient(organizationId: string, userId: string, id: string) {
    await this.assertIngredient(organizationId, id);
    await this.prisma.ingredient.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'ingredient',
      entityId: id,
    });
    return { id, deleted: true };
  }

  private async assertCategory(organizationId: string, id: string) {
    const category = await this.prisma.ingredientCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Ingredient category not found');
    return category;
  }

  private async assertIngredient(organizationId: string, id: string) {
    const ingredient = await this.prisma.ingredient.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!ingredient) throw new NotFoundException('Ingredient not found');
    return ingredient;
  }

  private serializeIngredient(ingredient: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    isPackaging: boolean;
    isSnackSku: boolean;
    trackStock: boolean;
    isActive: boolean;
    parLevel: Prisma.Decimal | null;
    reorderPoint: Prisma.Decimal | null;
    category: { id: string; name: string } | null;
    baseUom: { id: string; code: string; symbol: string };
  }) {
    return {
      id: ingredient.id,
      name: ingredient.name,
      code: ingredient.code,
      description: ingredient.description,
      categoryId: ingredient.category?.id ?? null,
      categoryName: ingredient.category?.name ?? null,
      baseUomId: ingredient.baseUom.id,
      baseUom: ingredient.baseUom.code,
      isPackaging: ingredient.isPackaging,
      isSnackSku: ingredient.isSnackSku,
      trackStock: ingredient.trackStock,
      isActive: ingredient.isActive,
      parLevel: ingredient.parLevel ? decimalToString(ingredient.parLevel) : null,
      reorderPoint: ingredient.reorderPoint ? decimalToString(ingredient.reorderPoint) : null,
    };
  }
}

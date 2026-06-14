import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class RecipeAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listRecipes(organizationId: string, menuItemId?: string) {
    const items = await this.prisma.menuItem.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(menuItemId ? { id: menuItemId } : {}),
      },
      select: { id: true, name: true, code: true },
    });

    const itemIds = items.map((i) => i.id);
    const recipes = await this.prisma.recipe.findMany({
      where: { menuItemId: { in: itemIds }, deletedAt: null },
      include: {
        menuItem: { select: { id: true, name: true, code: true } },
        size: { select: { id: true, name: true, code: true } },
        lines: {
          include: {
            ingredient: { select: { id: true, name: true, code: true } },
            uom: { select: { code: true } },
          },
          orderBy: { sortOrder: 'asc' },
        },
        approvedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ menuItemId: 'asc' }, { version: 'desc' }],
    });

    return recipes.map((recipe) => ({
      id: recipe.id,
      menuItemId: recipe.menuItemId,
      menuItemName: recipe.menuItem.name,
      sizeId: recipe.sizeId,
      sizeName: recipe.size?.name ?? null,
      version: recipe.version,
      status: recipe.status,
      approvedAt: recipe.approvedAt?.toISOString() ?? null,
      approvedByName: recipe.approvedBy
        ? `${recipe.approvedBy.firstName} ${recipe.approvedBy.lastName}`
        : null,
      lineCount: recipe.lines.length,
      lines: recipe.lines.map((line) => ({
        id: line.id,
        ingredientId: line.ingredientId,
        ingredientName: line.ingredient.name,
        quantity: decimalToString(line.quantity),
        uom: line.uom.code,
        isOptional: line.isOptional,
      })),
    }));
  }

  async approveRecipe(organizationId: string, userId: string, recipeId: string) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      include: { menuItem: true, lines: true },
    });

    if (!recipe || recipe.menuItem.organizationId !== organizationId) {
      throw new NotFoundException('Recipe not found');
    }

    if (recipe.status === 'APPROVED') {
      throw new BadRequestException('Recipe is already approved');
    }

    if (!recipe.lines.length) {
      throw new BadRequestException('Recipe has no lines');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.recipe.updateMany({
        where: {
          menuItemId: recipe.menuItemId,
          sizeId: recipe.sizeId,
          status: 'APPROVED',
          id: { not: recipeId },
        },
        data: { status: 'ARCHIVED', effectiveTo: new Date() },
      });

      return tx.recipe.update({
        where: { id: recipeId },
        data: {
          status: 'APPROVED',
          approvedById: userId,
          approvedAt: new Date(),
        },
      });
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'RECIPE_APPROVE',
      entityType: 'recipe',
      entityId: recipeId,
      beforeState: { status: recipe.status },
      afterState: { status: 'APPROVED' },
    });

    return { id: updated.id, status: updated.status, approvedAt: updated.approvedAt?.toISOString() };
  }

  async createRecipe(
    organizationId: string,
    userId: string,
    dto: {
      menuItemId: string;
      sizeId?: string;
      notes?: string;
      lines: Array<{ ingredientId: string; quantity: string; uomId?: string; isOptional?: boolean }>;
    },
  ) {
    const menuItem = await this.prisma.menuItem.findFirst({
      where: { id: dto.menuItemId, organizationId, deletedAt: null },
    });
    if (!menuItem) throw new NotFoundException('Menu item not found');
    if (!dto.lines.length) throw new BadRequestException('Recipe must have at least one line');

    const latest = await this.prisma.recipe.findFirst({
      where: { menuItemId: dto.menuItemId, sizeId: dto.sizeId ?? null, deletedAt: null },
      orderBy: { version: 'desc' },
    });

    const recipe = await this.prisma.$transaction(async (tx) => {
      const created = await tx.recipe.create({
        data: {
          menuItemId: dto.menuItemId,
          sizeId: dto.sizeId,
          version: (latest?.version ?? 0) + 1,
          status: 'DRAFT',
          notes: dto.notes,
        },
      });

      for (const [index, line] of dto.lines.entries()) {
        const ingredient = await tx.ingredient.findFirst({
          where: { id: line.ingredientId, organizationId },
        });
        if (!ingredient) throw new NotFoundException(`Ingredient not found: ${line.ingredientId}`);

        await tx.recipeLine.create({
          data: {
            recipeId: created.id,
            ingredientId: line.ingredientId,
            quantity: line.quantity,
            uomId: line.uomId ?? ingredient.baseUomId,
            isOptional: line.isOptional ?? false,
            sortOrder: index,
          },
        });
      }

      return created;
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'recipe',
      entityId: recipe.id,
      afterState: { menuItemId: dto.menuItemId, version: recipe.version },
    });

    return { id: recipe.id, version: recipe.version, status: recipe.status };
  }

  async updateRecipeLines(
    organizationId: string,
    userId: string,
    recipeId: string,
    lines: Array<{ ingredientId: string; quantity: string; uomId?: string; isOptional?: boolean }>,
  ) {
    const recipe = await this.prisma.recipe.findFirst({
      where: { id: recipeId, deletedAt: null },
      include: { menuItem: true },
    });
    if (!recipe || recipe.menuItem.organizationId !== organizationId) {
      throw new NotFoundException('Recipe not found');
    }
    if (recipe.status !== 'DRAFT') {
      throw new BadRequestException('Only draft recipes can be edited');
    }
    if (!lines.length) throw new BadRequestException('Recipe must have at least one line');

    await this.prisma.$transaction(async (tx) => {
      await tx.recipeLine.deleteMany({ where: { recipeId } });
      for (const [index, line] of lines.entries()) {
        const ingredient = await tx.ingredient.findFirst({
          where: { id: line.ingredientId, organizationId },
        });
        if (!ingredient) throw new NotFoundException(`Ingredient not found: ${line.ingredientId}`);

        await tx.recipeLine.create({
          data: {
            recipeId,
            ingredientId: line.ingredientId,
            quantity: line.quantity,
            uomId: line.uomId ?? ingredient.baseUomId,
            isOptional: line.isOptional ?? false,
            sortOrder: index,
          },
        });
      }
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'recipe',
      entityId: recipeId,
      afterState: { lineCount: lines.length },
    });

    return { id: recipeId, lineCount: lines.length };
  }
}

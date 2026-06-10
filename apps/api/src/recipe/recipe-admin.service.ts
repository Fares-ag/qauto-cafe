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
}

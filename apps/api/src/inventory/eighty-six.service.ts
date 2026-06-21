import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EightySixService {
  constructor(private readonly prisma: PrismaService) {}

  async propagateAfterConsumption(branchId: string, ingredientIds: string[]) {
    for (const ingredientId of ingredientIds) {
      const available = await this.prisma.stockLayer.aggregate({
        where: { branchId, ingredientId, quantityRemaining: { gt: 0 } },
        _sum: { quantityRemaining: true },
      });

      const qty = Number(available._sum.quantityRemaining ?? 0);

      if (qty <= 0) {
        await this.markItems86ForIngredient(branchId, ingredientId, true);
      }
    }
  }

  async propagateAfterRestock(branchId: string, ingredientId: string) {
    const available = await this.prisma.stockLayer.aggregate({
      where: { branchId, ingredientId, quantityRemaining: { gt: 0 } },
      _sum: { quantityRemaining: true },
    });

    if (Number(available._sum.quantityRemaining ?? 0) > 0) {
      await this.markItems86ForIngredient(branchId, ingredientId, false);
    }
  }

  private async markItems86ForIngredient(
    branchId: string,
    ingredientId: string,
    is86: boolean,
  ) {
    const snackItem = await this.prisma.menuItem.findFirst({
      where: { snackIngredientId: ingredientId, deletedAt: null },
    });

    const recipeItems = await this.prisma.recipeLine.findMany({
      where: { ingredientId, recipe: { status: 'APPROVED', deletedAt: null } },
      select: { recipe: { select: { menuItemId: true } } },
      distinct: ['recipeId'],
    });

    const menuItemIds = new Set<string>();
    if (snackItem) menuItemIds.add(snackItem.id);
    for (const line of recipeItems) {
      menuItemIds.add(line.recipe.menuItemId);
    }

    for (const menuItemId of menuItemIds) {
      await this.prisma.branchMenuItem.upsert({
        where: { branchId_menuItemId: { branchId, menuItemId } },
        update: { is86 },
        create: { branchId, menuItemId, is86, isAvailable: true },
      });
    }
  }
}

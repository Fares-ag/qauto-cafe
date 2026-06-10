import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class MenuAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listItems(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const items = await this.prisma.menuItem.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      include: {
        category: { select: { id: true, name: true } },
        branchAvailability: { where: { branchId } },
        recipes: {
          where: { deletedAt: null },
          select: { id: true, status: true, version: true, sizeId: true },
        },
      },
      orderBy: [{ category: { sortOrder: 'asc' } }, { sortOrder: 'asc' }],
    });

    return items.map((item) => {
      const availability = item.branchAvailability[0];
      return {
        id: item.id,
        name: item.name,
        code: item.code,
        type: item.type,
        categoryId: item.categoryId,
        categoryName: item.category.name,
        basePrice: decimalToString(item.basePrice),
        imageUrl: item.imageUrl,
        is86: availability?.is86 ?? false,
        isAvailable: availability?.isAvailable ?? true,
        priceOverride: availability?.priceOverride
          ? decimalToString(availability.priceOverride)
          : null,
        recipeCount: item.recipes.length,
        approvedRecipeCount: item.recipes.filter((r) => r.status === 'APPROVED').length,
      };
    });
  }

  async updateAvailability(
    organizationId: string,
    userId: string,
    menuItemId: string,
    branchId: string,
    data: { is86?: boolean; isAvailable?: boolean; priceOverride?: string | null },
  ) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id: menuItemId, organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Menu item not found');

    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const existing = await this.prisma.branchMenuItem.findUnique({
      where: { branchId_menuItemId: { branchId, menuItemId } },
    });

    const updated = await this.prisma.branchMenuItem.upsert({
      where: { branchId_menuItemId: { branchId, menuItemId } },
      update: {
        ...(data.is86 !== undefined ? { is86: data.is86 } : {}),
        ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable } : {}),
        ...(data.priceOverride !== undefined
          ? { priceOverride: data.priceOverride === null ? null : data.priceOverride }
          : {}),
      },
      create: {
        branchId,
        menuItemId,
        is86: data.is86 ?? false,
        isAvailable: data.isAvailable ?? true,
        priceOverride: data.priceOverride ?? null,
      },
    });

    await this.audit.log({
      organizationId,
      branchId,
      userId,
      action: 'UPDATE',
      entityType: 'branch_menu_item',
      entityId: updated.id,
      beforeState: existing
        ? { is86: existing.is86, isAvailable: existing.isAvailable }
        : undefined,
      afterState: { is86: updated.is86, isAvailable: updated.isAvailable },
    });

    return {
      menuItemId,
      branchId,
      is86: updated.is86,
      isAvailable: updated.isAvailable,
      priceOverride: updated.priceOverride ? decimalToString(updated.priceOverride) : null,
    };
  }
}

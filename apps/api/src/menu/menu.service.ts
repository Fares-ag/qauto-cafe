import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalog(branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null, isActive: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const categories = await this.prisma.menuCategory.findMany({
      where: {
        organizationId: branch.organizationId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { sortOrder: 'asc' },
      include: {
        items: {
          where: { isActive: true, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
          include: {
            sizes: {
              where: { isActive: true, deletedAt: null },
              orderBy: { sortOrder: 'asc' },
            },
            branchAvailability: {
              where: { branchId },
            },
            modifierGroups: {
              orderBy: { sortOrder: 'asc' },
              include: {
                modifierGroup: {
                  include: {
                    modifiers: {
                      where: { isActive: true, deletedAt: null },
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    return {
      branchId,
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name,
        sortOrder: category.sortOrder,
        items: category.items.map((item) => {
          const availability = item.branchAvailability[0];
          const price = availability?.priceOverride ?? item.basePrice;

          return {
            id: item.id,
            name: item.name,
            code: item.code,
            type: item.type,
            description: item.description,
            imageUrl: item.imageUrl,
            basePrice: this.decimalToString(price),
            is86: availability?.is86 ?? false,
            isAvailable: availability?.isAvailable ?? true,
            sizes: item.sizes.map((size) => ({
              id: size.id,
              name: size.name,
              code: size.code,
              priceAdjustment: this.decimalToString(size.priceAdjustment),
              isDefault: size.isDefault,
            })),
            modifierGroups: item.modifierGroups.map((link) => ({
              id: link.modifierGroup.id,
              name: link.modifierGroup.name,
              minSelections: link.modifierGroup.minSelections,
              maxSelections: link.modifierGroup.maxSelections,
              isRequired: link.modifierGroup.isRequired,
              modifiers: link.modifierGroup.modifiers.map((mod) => ({
                id: mod.id,
                name: mod.name,
                code: mod.code,
                priceAdjustment: this.decimalToString(mod.priceAdjustment),
              })),
            })),
          };
        }),
      })),
    };
  }

  private decimalToString(value: Prisma.Decimal | number | string): string {
    return new Prisma.Decimal(value).toFixed(4);
  }
}

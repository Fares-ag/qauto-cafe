import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decimalToString } from '../common/utils/decimal.util';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  CreateMenuItemSizeDto,
  CreateModifierDto,
  CreateModifierGroupDto,
  LinkModifierGroupDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
  UpdateMenuItemSizeDto,
  UpdateModifierDto,
  UpdateModifierGroupDto,
} from './dto/menu-admin.dto';

@Injectable()
export class MenuAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async bustCatalog(_branchId?: string, _organizationId?: string) {
    // No server-side cache — clients refetch from the database via the API.
  }

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

    await this.bustCatalog(branchId);

    return {
      menuItemId,
      branchId,
      is86: updated.is86,
      isAvailable: updated.isAvailable,
      priceOverride: updated.priceOverride ? decimalToString(updated.priceOverride) : null,
    };
  }

  listCategories(organizationId: string) {
    return this.prisma.menuCategory.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { items: true } } },
    }).then((rows) =>
      rows.map((c) => ({
        id: c.id,
        name: c.name,
        sortOrder: c.sortOrder,
        isActive: c.isActive,
        itemCount: c._count.items,
      })),
    );
  }

  async createCategory(organizationId: string, userId: string, dto: CreateMenuCategoryDto) {
    const category = await this.prisma.menuCategory.create({
      data: { organizationId, name: dto.name, sortOrder: dto.sortOrder ?? 0 },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'menu_category',
      entityId: category.id,
      afterState: { name: dto.name },
    });
    await this.bustCatalog(undefined, organizationId);
    return { id: category.id, name: category.name, sortOrder: category.sortOrder, isActive: true };
  }

  async updateCategory(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateMenuCategoryDto,
  ) {
    await this.assertMenuCategory(organizationId, id);
    const updated = await this.prisma.menuCategory.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'menu_category',
      entityId: id,
      afterState: { name: updated.name },
    });
    await this.bustCatalog(undefined, organizationId);
    return { id: updated.id, name: updated.name, sortOrder: updated.sortOrder, isActive: updated.isActive };
  }

  async removeCategory(organizationId: string, userId: string, id: string) {
    await this.assertMenuCategory(organizationId, id);
    await this.prisma.menuCategory.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      organizationId,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'menu_category',
      entityId: id,
    });
    await this.bustCatalog(undefined, organizationId);
    return { id, deleted: true };
  }

  async createItem(organizationId: string, userId: string, dto: CreateMenuItemDto) {
    const dup = await this.prisma.menuItem.findFirst({
      where: { organizationId, code: dto.code, deletedAt: null },
    });
    if (dup) throw new ConflictException('Menu item code already exists');
    await this.assertMenuCategory(organizationId, dto.categoryId);

    const item = await this.prisma.menuItem.create({
      data: {
        organizationId,
        categoryId: dto.categoryId,
        name: dto.name,
        code: dto.code,
        type: dto.type,
        basePrice: dto.basePrice,
        description: dto.description,
        imageUrl: dto.imageUrl,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'menu_item',
      entityId: item.id,
      afterState: { name: dto.name, code: dto.code },
    });

    await this.bustCatalog(undefined, organizationId);
    return this.serializeItem(item);
  }

  async updateItem(organizationId: string, userId: string, id: string, dto: UpdateMenuItemDto) {
    await this.assertMenuItem(organizationId, id);
    if (dto.categoryId) await this.assertMenuCategory(organizationId, dto.categoryId);

    const updated = await this.prisma.menuItem.update({
      where: { id },
      data: {
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.basePrice !== undefined ? { basePrice: dto.basePrice } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.imageUrl !== undefined
          ? { imageUrl: dto.imageUrl === '' ? null : dto.imageUrl }
          : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'UPDATE',
      entityType: 'menu_item',
      entityId: id,
      afterState: { name: updated.name },
    });

    await this.bustCatalog(undefined, organizationId);
    return this.serializeItem(updated);
  }

  async removeItem(organizationId: string, userId: string, id: string) {
    await this.assertMenuItem(organizationId, id);
    await this.prisma.menuItem.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'menu_item',
      entityId: id,
    });
    await this.bustCatalog(undefined, organizationId);
    return { id, deleted: true };
  }

  async listSizes(organizationId: string, menuItemId: string) {
    await this.assertMenuItem(organizationId, menuItemId);
    const sizes = await this.prisma.menuItemSize.findMany({
      where: { menuItemId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return sizes.map((s) => this.serializeSize(s));
  }

  async createSize(
    organizationId: string,
    userId: string,
    menuItemId: string,
    dto: CreateMenuItemSizeDto,
  ) {
    await this.assertMenuItem(organizationId, menuItemId);
    if (dto.isDefault) {
      await this.prisma.menuItemSize.updateMany({
        where: { menuItemId, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const size = await this.prisma.menuItemSize.create({
      data: {
        menuItemId,
        name: dto.name,
        code: dto.code,
        priceAdjustment: dto.priceAdjustment ?? 0,
        isDefault: dto.isDefault ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'menu_item_size',
      entityId: size.id,
      afterState: { name: dto.name, menuItemId },
    });

    return this.serializeSize(size);
  }

  async updateSize(
    organizationId: string,
    userId: string,
    menuItemId: string,
    sizeId: string,
    dto: UpdateMenuItemSizeDto,
  ) {
    await this.assertMenuItemSize(organizationId, menuItemId, sizeId);
    if (dto.isDefault) {
      await this.prisma.menuItemSize.updateMany({
        where: { menuItemId, deletedAt: null },
        data: { isDefault: false },
      });
    }

    const updated = await this.prisma.menuItemSize.update({
      where: { id: sizeId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.priceAdjustment !== undefined ? { priceAdjustment: dto.priceAdjustment } : {}),
        ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });

    return this.serializeSize(updated);
  }

  async removeSize(organizationId: string, userId: string, menuItemId: string, sizeId: string) {
    await this.assertMenuItemSize(organizationId, menuItemId, sizeId);
    await this.prisma.menuItemSize.update({
      where: { id: sizeId },
      data: { deletedAt: new Date(), isActive: false },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'menu_item_size',
      entityId: sizeId,
    });
    return { id: sizeId, deleted: true };
  }

  listModifierGroups(organizationId: string) {
    return this.prisma.modifierGroup.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { modifiers: true } } },
    }).then((rows) =>
      rows.map((g) => ({
        id: g.id,
        name: g.name,
        minSelections: g.minSelections,
        maxSelections: g.maxSelections,
        isRequired: g.isRequired,
        sortOrder: g.sortOrder,
        modifierCount: g._count.modifiers,
      })),
    );
  }

  async createModifierGroup(organizationId: string, userId: string, dto: CreateModifierGroupDto) {
    const group = await this.prisma.modifierGroup.create({
      data: {
        organizationId,
        name: dto.name,
        minSelections: dto.minSelections ?? 0,
        maxSelections: dto.maxSelections ?? 1,
        isRequired: dto.isRequired ?? false,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'modifier_group',
      entityId: group.id,
      afterState: { name: dto.name },
    });
    return { id: group.id, name: group.name };
  }

  async updateModifierGroup(
    organizationId: string,
    userId: string,
    id: string,
    dto: UpdateModifierGroupDto,
  ) {
    await this.assertModifierGroup(organizationId, id);
    const updated = await this.prisma.modifierGroup.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.minSelections !== undefined ? { minSelections: dto.minSelections } : {}),
        ...(dto.maxSelections !== undefined ? { maxSelections: dto.maxSelections } : {}),
        ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return { id: updated.id, name: updated.name };
  }

  async removeModifierGroup(organizationId: string, userId: string, id: string) {
    await this.assertModifierGroup(organizationId, id);
    await this.prisma.modifierGroup.update({ where: { id }, data: { deletedAt: new Date() } });
    await this.audit.log({
      organizationId,
      userId,
      action: 'SOFT_DELETE',
      entityType: 'modifier_group',
      entityId: id,
    });
    return { id, deleted: true };
  }

  async listModifiers(organizationId: string, groupId: string) {
    await this.assertModifierGroup(organizationId, groupId);
    const modifiers = await this.prisma.modifier.findMany({
      where: { modifierGroupId: groupId, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
    });
    return modifiers.map((m) => this.serializeModifier(m));
  }

  async createModifier(
    organizationId: string,
    userId: string,
    groupId: string,
    dto: CreateModifierDto,
  ) {
    await this.assertModifierGroup(organizationId, groupId);
    const modifier = await this.prisma.modifier.create({
      data: {
        modifierGroupId: groupId,
        name: dto.name,
        code: dto.code,
        priceAdjustment: dto.priceAdjustment ?? 0,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
    return this.serializeModifier(modifier);
  }

  async updateModifier(
    organizationId: string,
    userId: string,
    groupId: string,
    modifierId: string,
    dto: UpdateModifierDto,
  ) {
    await this.assertModifier(organizationId, groupId, modifierId);
    const updated = await this.prisma.modifier.update({
      where: { id: modifierId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.priceAdjustment !== undefined ? { priceAdjustment: dto.priceAdjustment } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
    });
    return this.serializeModifier(updated);
  }

  async removeModifier(
    organizationId: string,
    userId: string,
    groupId: string,
    modifierId: string,
  ) {
    await this.assertModifier(organizationId, groupId, modifierId);
    await this.prisma.modifier.update({
      where: { id: modifierId },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { id: modifierId, deleted: true };
  }

  async linkModifierGroup(
    organizationId: string,
    menuItemId: string,
    dto: LinkModifierGroupDto,
  ) {
    await this.assertMenuItem(organizationId, menuItemId);
    await this.assertModifierGroup(organizationId, dto.modifierGroupId);

    await this.prisma.menuItemModifierGroup.upsert({
      where: {
        menuItemId_modifierGroupId: {
          menuItemId,
          modifierGroupId: dto.modifierGroupId,
        },
      },
      update: { sortOrder: dto.sortOrder ?? 0 },
      create: {
        menuItemId,
        modifierGroupId: dto.modifierGroupId,
        sortOrder: dto.sortOrder ?? 0,
      },
    });

    return { menuItemId, modifierGroupId: dto.modifierGroupId };
  }

  async unlinkModifierGroup(organizationId: string, menuItemId: string, groupId: string) {
    await this.assertMenuItem(organizationId, menuItemId);
    await this.prisma.menuItemModifierGroup.deleteMany({
      where: { menuItemId, modifierGroupId: groupId },
    });
    return { menuItemId, modifierGroupId: groupId, unlinked: true };
  }

  private async assertMenuCategory(organizationId: string, id: string) {
    const category = await this.prisma.menuCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!category) throw new NotFoundException('Menu category not found');
    return category;
  }

  private async assertMenuItem(organizationId: string, id: string) {
    const item = await this.prisma.menuItem.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Menu item not found');
    return item;
  }

  private async assertMenuItemSize(organizationId: string, menuItemId: string, sizeId: string) {
    const size = await this.prisma.menuItemSize.findFirst({
      where: { id: sizeId, menuItemId, deletedAt: null, menuItem: { organizationId } },
    });
    if (!size) throw new NotFoundException('Menu item size not found');
    return size;
  }

  private async assertModifierGroup(organizationId: string, id: string) {
    const group = await this.prisma.modifierGroup.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!group) throw new NotFoundException('Modifier group not found');
    return group;
  }

  private async assertModifier(organizationId: string, groupId: string, modifierId: string) {
    const modifier = await this.prisma.modifier.findFirst({
      where: {
        id: modifierId,
        modifierGroupId: groupId,
        deletedAt: null,
        modifierGroup: { organizationId },
      },
    });
    if (!modifier) throw new NotFoundException('Modifier not found');
    return modifier;
  }

  private serializeItem(item: {
    id: string;
    categoryId: string;
    name: string;
    code: string;
    type: string;
    basePrice: Prisma.Decimal;
    description: string | null;
    imageUrl: string | null;
    sortOrder: number;
    isActive: boolean;
  }) {
    return {
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      code: item.code,
      type: item.type,
      basePrice: decimalToString(item.basePrice),
      description: item.description,
      imageUrl: item.imageUrl,
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    };
  }

  private serializeSize(size: {
    id: string;
    menuItemId: string;
    name: string;
    code: string;
    priceAdjustment: Prisma.Decimal;
    isDefault: boolean;
    isActive: boolean;
    sortOrder: number;
  }) {
    return {
      id: size.id,
      menuItemId: size.menuItemId,
      name: size.name,
      code: size.code,
      priceAdjustment: decimalToString(size.priceAdjustment),
      isDefault: size.isDefault,
      isActive: size.isActive,
      sortOrder: size.sortOrder,
    };
  }

  private serializeModifier(modifier: {
    id: string;
    modifierGroupId: string;
    name: string;
    code: string;
    priceAdjustment: Prisma.Decimal;
    isActive: boolean;
    sortOrder: number;
  }) {
    return {
      id: modifier.id,
      modifierGroupId: modifier.modifierGroupId,
      name: modifier.name,
      code: modifier.code,
      priceAdjustment: decimalToString(modifier.priceAdjustment),
      isActive: modifier.isActive,
      sortOrder: modifier.sortOrder,
    };
  }
}

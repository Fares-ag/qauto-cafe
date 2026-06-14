import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { MenuService } from './menu.service';
import { MenuAdminService } from './menu-admin.service';
import {
  CreateMenuCategoryDto,
  CreateMenuItemDto,
  CreateMenuItemSizeDto,
  CreateModifierDto,
  CreateModifierGroupDto,
  LinkModifierGroupDto,
  SetBranchPriceOverrideDto,
  UpdateMenuCategoryDto,
  UpdateMenuItemDto,
  UpdateMenuItemSizeDto,
  UpdateModifierDto,
  UpdateModifierGroupDto,
} from './dto/menu-admin.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

class UpdateAvailabilityDto {
  @IsString()
  branchId!: string;

  @IsOptional()
  @IsBoolean()
  is86?: boolean;

  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @IsOptional()
  @IsString()
  priceOverride?: string | null;
}

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly menuAdmin: MenuAdminService,
  ) {}

  @Get('catalog')
  @UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
  @Permissions('order.create', 'menu.view', 'pos.access', 'bar.access')
  getCatalog(@Query('branchId') branchId: string) {
    return this.menuService.getCatalog(branchId);
  }

  @Get('admin/categories')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.view')
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.menuAdmin.listCategories(user.organizationId);
  }

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMenuCategoryDto) {
    return this.menuAdmin.createCategory(user.organizationId, user.id, dto);
  }

  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateMenuCategoryDto,
  ) {
    return this.menuAdmin.updateCategory(user.organizationId, user.id, id, dto);
  }

  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  removeCategory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.menuAdmin.removeCategory(user.organizationId, user.id, id);
  }

  @Get('admin/items')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.view')
  listAdminItems(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.menuAdmin.listItems(user.organizationId, branchId);
  }

  @Post('admin/items')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  createItem(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateMenuItemDto) {
    return this.menuAdmin.createItem(user.organizationId, user.id, dto);
  }

  @Patch('admin/items/:menuItemId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: UpdateMenuItemDto,
  ) {
    return this.menuAdmin.updateItem(user.organizationId, user.id, menuItemId, dto);
  }

  @Delete('admin/items/:menuItemId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  removeItem(@CurrentUser() user: AuthenticatedUser, @Param('menuItemId') menuItemId: string) {
    return this.menuAdmin.removeItem(user.organizationId, user.id, menuItemId);
  }

  @Patch('admin/items/:menuItemId/availability')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.86', 'menu.manage')
  updateAvailability(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: UpdateAvailabilityDto,
  ) {
    return this.menuAdmin.updateAvailability(
      user.organizationId,
      user.id,
      menuItemId,
      dto.branchId,
      { is86: dto.is86, isAvailable: dto.isAvailable, priceOverride: dto.priceOverride },
    );
  }

  @Patch('admin/items/:menuItemId/price-override')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  setPriceOverride(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: SetBranchPriceOverrideDto,
  ) {
    return this.menuAdmin.updateAvailability(
      user.organizationId,
      user.id,
      menuItemId,
      dto.branchId,
      { priceOverride: dto.priceOverride },
    );
  }

  @Get('admin/items/:menuItemId/sizes')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.view')
  listSizes(@CurrentUser() user: AuthenticatedUser, @Param('menuItemId') menuItemId: string) {
    return this.menuAdmin.listSizes(user.organizationId, menuItemId);
  }

  @Post('admin/items/:menuItemId/sizes')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  createSize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: CreateMenuItemSizeDto,
  ) {
    return this.menuAdmin.createSize(user.organizationId, user.id, menuItemId, dto);
  }

  @Patch('admin/items/:menuItemId/sizes/:sizeId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  updateSize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Param('sizeId') sizeId: string,
    @Body() dto: UpdateMenuItemSizeDto,
  ) {
    return this.menuAdmin.updateSize(user.organizationId, user.id, menuItemId, sizeId, dto);
  }

  @Delete('admin/items/:menuItemId/sizes/:sizeId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.manage')
  removeSize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Param('sizeId') sizeId: string,
  ) {
    return this.menuAdmin.removeSize(user.organizationId, user.id, menuItemId, sizeId);
  }

  @Get('admin/modifier-groups')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.view', 'modifier.manage')
  listModifierGroups(@CurrentUser() user: AuthenticatedUser) {
    return this.menuAdmin.listModifierGroups(user.organizationId);
  }

  @Post('admin/modifier-groups')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  createModifierGroup(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateModifierGroupDto) {
    return this.menuAdmin.createModifierGroup(user.organizationId, user.id, dto);
  }

  @Patch('admin/modifier-groups/:groupId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  updateModifierGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: UpdateModifierGroupDto,
  ) {
    return this.menuAdmin.updateModifierGroup(user.organizationId, user.id, groupId, dto);
  }

  @Delete('admin/modifier-groups/:groupId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  removeModifierGroup(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.menuAdmin.removeModifierGroup(user.organizationId, user.id, groupId);
  }

  @Get('admin/modifier-groups/:groupId/modifiers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('menu.view', 'modifier.manage')
  listModifiers(@CurrentUser() user: AuthenticatedUser, @Param('groupId') groupId: string) {
    return this.menuAdmin.listModifiers(user.organizationId, groupId);
  }

  @Post('admin/modifier-groups/:groupId/modifiers')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  createModifier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Body() dto: CreateModifierDto,
  ) {
    return this.menuAdmin.createModifier(user.organizationId, user.id, groupId, dto);
  }

  @Patch('admin/modifier-groups/:groupId/modifiers/:modifierId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  updateModifier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('modifierId') modifierId: string,
    @Body() dto: UpdateModifierDto,
  ) {
    return this.menuAdmin.updateModifier(user.organizationId, user.id, groupId, modifierId, dto);
  }

  @Delete('admin/modifier-groups/:groupId/modifiers/:modifierId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  removeModifier(
    @CurrentUser() user: AuthenticatedUser,
    @Param('groupId') groupId: string,
    @Param('modifierId') modifierId: string,
  ) {
    return this.menuAdmin.removeModifier(user.organizationId, user.id, groupId, modifierId);
  }

  @Post('admin/items/:menuItemId/modifier-groups')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  linkModifierGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Body() dto: LinkModifierGroupDto,
  ) {
    return this.menuAdmin.linkModifierGroup(user.organizationId, menuItemId, dto);
  }

  @Delete('admin/items/:menuItemId/modifier-groups/:groupId')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('modifier.manage')
  unlinkModifierGroup(
    @CurrentUser() user: AuthenticatedUser,
    @Param('menuItemId') menuItemId: string,
    @Param('groupId') groupId: string,
  ) {
    return this.menuAdmin.unlinkModifierGroup(user.organizationId, menuItemId, groupId);
  }
}

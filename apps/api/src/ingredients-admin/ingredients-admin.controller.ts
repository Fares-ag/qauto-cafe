import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { IngredientsAdminService } from './ingredients-admin.service';
import {
  CreateIngredientCategoryDto,
  CreateIngredientDto,
  UpdateIngredientCategoryDto,
  UpdateIngredientDto,
} from './dto/ingredient.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('admin/ingredients')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class IngredientsAdminController {
  constructor(private readonly ingredientsAdmin: IngredientsAdminService) {}

  @Get('categories')
  @Permissions('ingredient.view')
  listCategories(@CurrentUser() user: AuthenticatedUser) {
    return this.ingredientsAdmin.listCategories(user.organizationId);
  }

  @Post('categories')
  @Permissions('ingredient.manage')
  createCategory(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateIngredientCategoryDto) {
    return this.ingredientsAdmin.createCategory(user.organizationId, user.id, dto);
  }

  @Patch('categories/:id')
  @Permissions('ingredient.manage')
  updateCategory(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIngredientCategoryDto,
  ) {
    return this.ingredientsAdmin.updateCategory(user.organizationId, user.id, id, dto);
  }

  @Delete('categories/:id')
  @Permissions('ingredient.manage')
  removeCategory(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ingredientsAdmin.removeCategory(user.organizationId, user.id, id);
  }

  @Get()
  @Permissions('ingredient.view')
  listIngredients(@CurrentUser() user: AuthenticatedUser) {
    return this.ingredientsAdmin.listIngredients(user.organizationId);
  }

  @Post()
  @Permissions('ingredient.manage')
  createIngredient(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateIngredientDto) {
    return this.ingredientsAdmin.createIngredient(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @Permissions('ingredient.manage')
  updateIngredient(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
  ) {
    return this.ingredientsAdmin.updateIngredient(user.organizationId, user.id, id, dto);
  }

  @Delete(':id')
  @Permissions('ingredient.manage')
  removeIngredient(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ingredientsAdmin.removeIngredient(user.organizationId, user.id, id);
  }
}

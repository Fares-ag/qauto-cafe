import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { RecipeEngineService } from './recipe-engine.service';

import { RecipeAdminService } from './recipe-admin.service';

import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

import { IsArray, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';



class SimulateLineDto {

  @IsString()

  @IsNotEmpty()

  menuItemId!: string;



  @IsOptional()

  @IsString()

  @IsNotEmpty()

  sizeId?: string;



  @IsOptional()

  @IsArray()

  @IsString({ each: true })

  modifierIds?: string[];



  @IsOptional()

  quantity?: number;

}



class SimulateBomDto {

  @IsString()

  @IsNotEmpty()

  branchId!: string;



  @IsArray()

  @ValidateNested({ each: true })

  @Type(() => SimulateLineDto)

  lines!: SimulateLineDto[];

}



@Controller('recipes')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
export class RecipeController {

  constructor(

    private readonly recipeEngine: RecipeEngineService,

    private readonly recipeAdmin: RecipeAdminService,

  ) {}



  @Post('simulate')
  @Permissions('order.create', 'inventory.manage')
  simulate(@Body() dto: SimulateBomDto) {

    return Promise.all(

      dto.lines.map(async (line) => {

        const result = await this.recipeEngine.simulate({

          branchId: dto.branchId,

          menuItemId: line.menuItemId,

          sizeId: line.sizeId,

          modifierIds: line.modifierIds ?? [],

          quantity: line.quantity ?? 1,

        });

        return { menuItemId: line.menuItemId, ...result };

      }),

    );

  }



  @Get('preview')
  @Permissions('order.create', 'inventory.manage')
  preview(

    @Query('menuItemId') menuItemId: string,

    @Query('sizeId') sizeId: string | undefined,

    @Query('branchId') branchId: string,

    @Query('modifierIds') modifierIds?: string,

  ) {

    return this.recipeEngine.simulate({

      branchId,

      menuItemId,

      sizeId,

      modifierIds: modifierIds ? modifierIds.split(',') : [],

      quantity: 1,

    });

  }



  @Get('admin')
  @Permissions('recipe.manage', 'inventory.manage')
  listAdmin(

    @CurrentUser() user: AuthenticatedUser,

    @Query('menuItemId') menuItemId?: string,

  ) {

    return this.recipeAdmin.listRecipes(user.organizationId, menuItemId);

  }



  @Post('admin')
  @Permissions('recipe.manage')
  createRecipe(

    @CurrentUser() user: AuthenticatedUser,

    @Body()

    dto: {

      menuItemId: string;

      sizeId?: string;

      notes?: string;

      lines: Array<{ ingredientId: string; quantity: string; uomId?: string; isOptional?: boolean }>;

    },

  ) {

    return this.recipeAdmin.createRecipe(user.organizationId, user.id, dto);

  }



  @Post(':id/approve')
  @Permissions('recipe.manage')
  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {

    return this.recipeAdmin.approveRecipe(user.organizationId, user.id, id);

  }



  @Patch(':id/lines')
  @Permissions('recipe.manage')
  updateLines(

    @CurrentUser() user: AuthenticatedUser,

    @Param('id') id: string,

    @Body()

    dto: { lines: Array<{ ingredientId: string; quantity: string; uomId?: string; isOptional?: boolean }> },

  ) {

    return this.recipeAdmin.updateRecipeLines(user.organizationId, user.id, id, dto.lines);

  }

}



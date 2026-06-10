import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';

import { RecipeEngineService } from './recipe-engine.service';

import { RecipeAdminService } from './recipe-admin.service';

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

@UseGuards(JwtAuthGuard)

export class RecipeController {

  constructor(

    private readonly recipeEngine: RecipeEngineService,

    private readonly recipeAdmin: RecipeAdminService,

  ) {}



  @Post('simulate')

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

  listAdmin(

    @CurrentUser() user: AuthenticatedUser,

    @Query('menuItemId') menuItemId?: string,

  ) {

    return this.recipeAdmin.listRecipes(user.organizationId, menuItemId);

  }



  @Post(':id/approve')

  approve(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {

    return this.recipeAdmin.approveRecipe(user.organizationId, user.id, id);

  }

}



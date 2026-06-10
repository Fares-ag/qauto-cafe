import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { decimalToString } from '../common/utils/decimal.util';

import { InventoryOpsService } from './inventory-ops.service';

import { AdjustStockDto, ReceiveStockDto, WasteStockDto } from './dto/inventory-ops.dto';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { AuthenticatedUser } from '../auth/types/authenticated-user.type';



@Controller('inventory')

@UseGuards(JwtAuthGuard)

export class InventoryController {

  constructor(

    private readonly prisma: PrismaService,

    private readonly inventoryOps: InventoryOpsService,

  ) {}



  @Get('stock')

  async getStock(@Query('branchId') branchId: string) {

    const ingredients = await this.prisma.ingredient.findMany({

      where: { isActive: true, deletedAt: null, trackStock: true },

      include: { baseUom: true },

      orderBy: { name: 'asc' },

    });



    const stock = await Promise.all(

      ingredients.map(async (ingredient) => {

        const aggregate = await this.prisma.stockLayer.aggregate({

          where: { branchId, ingredientId: ingredient.id, quantityRemaining: { gt: 0 } },

          _sum: { quantityRemaining: true },

        });



        return {

          ingredientId: ingredient.id,

          name: ingredient.name,

          code: ingredient.code,

          isPackaging: ingredient.isPackaging,

          available: decimalToString(aggregate._sum.quantityRemaining ?? 0),

          uom: ingredient.baseUom.code,

        };

      }),

    );



    return { branchId, items: stock };

  }



  @Get('ingredients')

  async listIngredients(@CurrentUser() user: AuthenticatedUser) {

    const ingredients = await this.prisma.ingredient.findMany({

      where: { organizationId: user.organizationId, isActive: true, deletedAt: null },

      include: { baseUom: true },

      orderBy: { name: 'asc' },

    });



    return ingredients.map((i) => ({

      id: i.id,

      name: i.name,

      code: i.code,

      trackStock: i.trackStock,

      uom: i.baseUom.code,

    }));

  }



  @Get('movements')

  listMovements(

    @CurrentUser() user: AuthenticatedUser,

    @Query('branchId') branchId: string,

    @Query('ingredientId') ingredientId?: string,

    @Query('limit') limit?: string,

  ) {

    return this.inventoryOps.listMovements(user.organizationId, branchId, {

      ingredientId,

      limit: limit ? parseInt(limit, 10) : undefined,

    });

  }



  @Post('receive')

  receive(@CurrentUser() user: AuthenticatedUser, @Body() dto: ReceiveStockDto) {

    return this.inventoryOps.receive(user.organizationId, user.id, dto);

  }



  @Post('waste')

  waste(@CurrentUser() user: AuthenticatedUser, @Body() dto: WasteStockDto) {

    return this.inventoryOps.waste(user.organizationId, user.id, dto);

  }



  @Post('adjust')

  adjust(@CurrentUser() user: AuthenticatedUser, @Body() dto: AdjustStockDto) {

    return this.inventoryOps.adjust(user.organizationId, user.id, dto);

  }

}



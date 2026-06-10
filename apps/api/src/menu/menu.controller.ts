import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';

import { IsBoolean, IsOptional, IsString } from 'class-validator';

import { MenuService } from './menu.service';

import { MenuAdminService } from './menu-admin.service';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

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

@UseGuards(JwtAuthGuard)

export class MenuController {

  constructor(

    private readonly menuService: MenuService,

    private readonly menuAdmin: MenuAdminService,

  ) {}



  @Get('catalog')

  getCatalog(@Query('branchId') branchId: string) {

    return this.menuService.getCatalog(branchId);

  }



  @Get('admin/items')

  listAdminItems(

    @CurrentUser() user: AuthenticatedUser,

    @Query('branchId') branchId: string,

  ) {

    return this.menuAdmin.listItems(user.organizationId, branchId);

  }



  @Patch('admin/items/:menuItemId/availability')

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

      {

        is86: dto.is86,

        isAvailable: dto.isAvailable,

        priceOverride: dto.priceOverride,

      },

    );

  }

}



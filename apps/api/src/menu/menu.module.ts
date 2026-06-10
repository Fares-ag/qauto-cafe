import { Module } from '@nestjs/common';

import { MenuController } from './menu.controller';

import { MenuService } from './menu.service';

import { MenuAdminService } from './menu-admin.service';



@Module({

  controllers: [MenuController],

  providers: [MenuService, MenuAdminService],

  exports: [MenuService, MenuAdminService],

})

export class MenuModule {}



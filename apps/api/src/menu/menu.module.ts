import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuAdminService } from './menu-admin.service';
import { MenuImageStorageService } from './menu-image.storage';

@Module({
  imports: [AuthModule],
  controllers: [MenuController],
  providers: [MenuService, MenuAdminService, MenuImageStorageService],
  exports: [MenuService, MenuAdminService],
})
export class MenuModule {}


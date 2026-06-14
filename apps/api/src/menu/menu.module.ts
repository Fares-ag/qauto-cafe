import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuAdminService } from './menu-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [MenuController],
  providers: [MenuService, MenuAdminService],
  exports: [MenuService, MenuAdminService],
})
export class MenuModule {}


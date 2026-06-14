import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IngredientsAdminController } from './ingredients-admin.controller';
import { IngredientsAdminService } from './ingredients-admin.service';

@Module({
  imports: [AuthModule],
  controllers: [IngredientsAdminController],
  providers: [IngredientsAdminService],
  exports: [IngredientsAdminService],
})
export class IngredientsAdminModule {}

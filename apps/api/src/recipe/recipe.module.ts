import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { RecipeEngineService } from './recipe-engine.service';
import { RecipeAdminService } from './recipe-admin.service';
import { RecipeController } from './recipe.controller';

@Module({
  imports: [InventoryModule],
  controllers: [RecipeController],
  providers: [RecipeEngineService, RecipeAdminService],
  exports: [RecipeEngineService, RecipeAdminService],
})
export class RecipeModule {}

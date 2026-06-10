import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { SuppliersService } from './suppliers.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { SuppliersController, PurchaseOrdersController } from './procurement.controller';

@Module({
  imports: [InventoryModule],
  controllers: [SuppliersController, PurchaseOrdersController],
  providers: [SuppliersService, PurchaseOrdersService],
  exports: [SuppliersService, PurchaseOrdersService],
})
export class ProcurementModule {}

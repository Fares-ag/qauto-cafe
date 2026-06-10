import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';

import { OrdersService } from './orders.service';

import { OrderPaymentService } from './order-payment.service';

import { OrderQueueService } from './order-queue.service';

import { OrderRefundService } from './order-refund.service';

import { RecipeModule } from '../recipe/recipe.module';

import { InventoryModule } from '../inventory/inventory.module';

import { JobsModule } from '../jobs/jobs.module';



@Module({

  imports: [RecipeModule, InventoryModule, JobsModule],

  controllers: [OrdersController],

  providers: [OrdersService, OrderPaymentService, OrderQueueService, OrderRefundService],

  exports: [OrdersService, OrderPaymentService, OrderQueueService, OrderRefundService],

})

export class OrdersModule {}



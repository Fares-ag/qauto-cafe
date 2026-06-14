import { Module } from '@nestjs/common';

import { OrdersController } from './orders.controller';

import { OrdersService } from './orders.service';

import { OrderPaymentService } from './order-payment.service';

import { OrderFulfillmentService } from './order-fulfillment.service';

import { OrderDeferService } from './order-defer.service';

import { OrderQueueService } from './order-queue.service';

import { OrderRefundService } from './order-refund.service';

import { OrderDiscountService } from './order-discount.service';

import { RecipeModule } from '../recipe/recipe.module';

import { InventoryModule } from '../inventory/inventory.module';

import { JobsModule } from '../jobs/jobs.module';
import { LoyaltyModule } from '../loyalty/loyalty.module';
import { GiftCardsModule } from '../gift-cards/gift-cards.module';

@Module({
  imports: [RecipeModule, InventoryModule, JobsModule, LoyaltyModule, GiftCardsModule],

  controllers: [OrdersController],

  providers: [
    OrdersService,
    OrderFulfillmentService,
    OrderPaymentService,
    OrderDeferService,
    OrderQueueService,
    OrderRefundService,
    OrderDiscountService,
  ],

  exports: [
    OrdersService,
    OrderFulfillmentService,
    OrderPaymentService,
    OrderDeferService,
    OrderQueueService,
    OrderRefundService,
    OrderDiscountService,
  ],
})
export class OrdersModule {}

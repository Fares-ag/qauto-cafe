import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { DiscountsController } from './discounts.controller';

@Module({
  imports: [AuthModule, OrdersModule],
  controllers: [DiscountsController],
})
export class DiscountsModule {}

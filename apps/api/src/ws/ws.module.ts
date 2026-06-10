import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { EventsGateway } from './events.gateway';

@Module({
  imports: [AuthModule, forwardRef(() => OrdersModule)],
  providers: [EventsGateway],
  exports: [EventsGateway],
})
export class WsModule {}

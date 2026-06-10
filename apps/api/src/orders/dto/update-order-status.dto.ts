import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { OrderStatus } from '@prisma/client';

const QUEUE_STATUSES: OrderStatus[] = ['PAID', 'IN_PREP', 'READY'];

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus)
  status!: OrderStatus;
}

export { QUEUE_STATUSES };

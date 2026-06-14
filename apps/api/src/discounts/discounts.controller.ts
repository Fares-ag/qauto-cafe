import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { OrderDiscountService } from '../orders/order-discount.service';
import { ApplyOrderDiscountDto } from '../orders/dto/apply-discount.dto';
import { OrdersService } from '../orders/orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('orders/:orderId/discounts')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class DiscountsController {
  constructor(
    private readonly orderDiscountService: OrderDiscountService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  @Permissions('order.discount', 'order.update')
  list(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.orderDiscountService.list(orderId, user.organizationId);
  }

  @Post()
  @Permissions('order.discount')
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Body() dto: ApplyOrderDiscountDto,
  ) {
    return this.orderDiscountService
      .apply(orderId, user.organizationId, dto)
      .then(() => this.ordersService.findOne(orderId, user.organizationId));
  }

  @Delete()
  @Permissions('order.discount')
  clearAll(@CurrentUser() user: AuthenticatedUser, @Param('orderId') orderId: string) {
    return this.orderDiscountService
      .clear(orderId, user.organizationId)
      .then(() => this.ordersService.findOne(orderId, user.organizationId));
  }

  @Delete(':discountId')
  @Permissions('order.discount')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('orderId') orderId: string,
    @Param('discountId') discountId: string,
  ) {
    return this.orderDiscountService.removeById(orderId, user.organizationId, discountId);
  }
}

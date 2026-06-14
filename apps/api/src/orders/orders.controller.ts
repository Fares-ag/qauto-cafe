import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OrdersService } from './orders.service';
import { OrderPaymentService } from './order-payment.service';
import { OrderDeferService } from './order-defer.service';
import { OrderQueueService } from './order-queue.service';
import { OrderRefundService } from './order-refund.service';
import { CreateOrderDto, UpdateOrderLinesDto } from './dto/order.dto';
import { PayOrderDto, VoidOrderDto } from './dto/pay-order.dto';
import { RefundOrderDto } from './dto/refund-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { UpdateOrderCustomerDto } from './dto/update-order-customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('orders')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly orderPaymentService: OrderPaymentService,
    private readonly orderDeferService: OrderDeferService,
    private readonly orderQueueService: OrderQueueService,
    private readonly orderRefundService: OrderRefundService,
  ) {}

  @Post()
  @Permissions('order.create', 'pos.access')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.organizationId, user.id, dto);
  }

  @Get('queue')
  @Permissions('bar.access', 'bar.manage_queue', 'pos.access')
  getQueue(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.orderQueueService.getQueue(branchId, user.organizationId);
  }

  @Get()
  @Permissions('order.update', 'pos.access', 'report.view')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.ordersService.list(user.organizationId, {
      branchId,
      status,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get(':id')
  @Permissions('order.update', 'pos.access', 'report.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.ordersService.findOne(id, user.organizationId);
  }

  @Patch(':id/lines')
  @Permissions('order.update', 'pos.access')
  updateLines(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderLinesDto,
  ) {
    return this.ordersService.replaceLines(id, user.organizationId, dto.lines);
  }

  @Patch(':id/customer')
  @Permissions('order.update', 'pos.access')
  updateCustomer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderCustomerDto,
  ) {
    return this.orderDeferService.updateCustomer(id, user.organizationId, dto);
  }

  @Patch(':id/status')
  @Permissions('bar.manage_queue', 'pos.access')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderQueueService.updateStatus(id, user.organizationId, dto.status);
  }

  @Post(':id/defer')
  @Permissions('payment.process', 'order.update', 'pos.access')
  defer(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.orderDeferService.defer(id, user.organizationId, user.id);
  }

  @Post(':id/pay')
  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Permissions('payment.process', 'pos.access')
  pay(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: PayOrderDto,
  ) {
    return this.orderPaymentService.pay(id, user.organizationId, user.id, dto);
  }

  @Post(':id/void')
  @Permissions('order.void', 'payment.process')
  void(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: VoidOrderDto,
  ) {
    return this.orderPaymentService.voidOrder(id, user.organizationId, user.id, dto);
  }

  @Post(':id/refund')
  @Permissions('order.refund', 'payment.process')
  refund(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RefundOrderDto,
  ) {
    return this.orderRefundService.refund(id, user.organizationId, user.id, dto);
  }
}

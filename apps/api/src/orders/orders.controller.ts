import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';

import { OrdersService } from './orders.service';

import { OrderPaymentService } from './order-payment.service';

import { OrderQueueService } from './order-queue.service';

import { OrderRefundService } from './order-refund.service';

import { CreateOrderDto, UpdateOrderLinesDto } from './dto/order.dto';

import { PayOrderDto, VoidOrderDto } from './dto/pay-order.dto';

import { RefundOrderDto } from './dto/refund-order.dto';

import { UpdateOrderStatusDto } from './dto/update-order-status.dto';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { CurrentUser } from '../common/decorators/current-user.decorator';

import { AuthenticatedUser } from '../auth/types/authenticated-user.type';



@Controller('orders')

@UseGuards(JwtAuthGuard)

export class OrdersController {

  constructor(

    private readonly ordersService: OrdersService,

    private readonly orderPaymentService: OrderPaymentService,

    private readonly orderQueueService: OrderQueueService,

    private readonly orderRefundService: OrderRefundService,

  ) {}



  @Post()

  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateOrderDto) {

    return this.ordersService.create(user.organizationId, user.id, dto);

  }



  @Get('queue')

  getQueue(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {

    return this.orderQueueService.getQueue(branchId, user.organizationId);

  }



  @Get()

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

  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {

    return this.ordersService.findOne(id, user.organizationId);

  }



  @Patch(':id/lines')

  updateLines(

    @CurrentUser() user: AuthenticatedUser,

    @Param('id') id: string,

    @Body() dto: UpdateOrderLinesDto,

  ) {

    return this.ordersService.replaceLines(id, user.organizationId, dto.lines);

  }



  @Patch(':id/status')

  updateStatus(

    @CurrentUser() user: AuthenticatedUser,

    @Param('id') id: string,

    @Body() dto: UpdateOrderStatusDto,

  ) {

    return this.orderQueueService.updateStatus(id, user.organizationId, dto.status);

  }



  @Post(':id/pay')

  pay(

    @CurrentUser() user: AuthenticatedUser,

    @Param('id') id: string,

    @Body() dto: PayOrderDto,

  ) {

    return this.orderPaymentService.pay(id, user.organizationId, user.id, dto);

  }



  @Post(':id/void')

  void(

    @CurrentUser() user: AuthenticatedUser,

    @Param('id') id: string,

    @Body() dto: VoidOrderDto,

  ) {

    return this.orderPaymentService.voidOrder(id, user.organizationId, user.id, dto);

  }



  @Post(':id/refund')

  refund(

    @CurrentUser() user: AuthenticatedUser,

    @Param('id') id: string,

    @Body() dto: RefundOrderDto,

  ) {

    return this.orderRefundService.refund(id, user.organizationId, user.id, dto);

  }

}



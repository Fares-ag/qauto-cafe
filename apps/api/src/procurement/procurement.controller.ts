import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import {
  CreatePurchaseOrderDto,
  CreateSupplierDto,
  ReceivePurchaseOrderDto,
  UpdatePurchaseOrderDto,
} from './dto/procurement.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('suppliers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('supplier.manage', 'inventory.manage')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.suppliersService.list(user.organizationId);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSupplierDto) {
    return this.suppliersService.create(user.organizationId, user.id, dto);
  }
}

@Controller('purchase-orders')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
@Permissions('po.manage', 'inventory.manage')
export class PurchaseOrdersController {
  constructor(private readonly purchaseOrdersService: PurchaseOrdersService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
  ) {
    return this.purchaseOrdersService.list(user.organizationId, branchId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseOrdersService.findOne(user.organizationId, id);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePurchaseOrderDto) {
    return this.purchaseOrdersService.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.update(user.organizationId, user.id, id, dto);
  }

  @Post(':id/send')
  send(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.purchaseOrdersService.send(user.organizationId, user.id, id);
  }

  @Post(':id/receive')
  receive(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
  ) {
    return this.purchaseOrdersService.receive(user.organizationId, user.id, id, dto);
  }
}

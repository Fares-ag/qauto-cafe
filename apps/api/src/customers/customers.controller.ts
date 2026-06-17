import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @Permissions('customer.view', 'pos.access')
  findAll(@CurrentUser() user: AuthenticatedUser, @Query('q') q?: string) {
    if (q?.trim()) {
      return this.customersService.search(user.organizationId, q);
    }
    return this.customersService.findAll(user.organizationId);
  }

  @Get('directory')
  @Permissions('customer.view', 'pos.access')
  getDirectory(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
  ) {
    return this.customersService.getDirectory(user.organizationId, q);
  }

  @Get('register-lookup')
  @Permissions('customer.view', 'pos.access')
  registerLookup(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') q?: string,
  ) {
    return this.customersService.registerLookup(user.organizationId, q);
  }

  @Get('departments')
  @Permissions('customer.view', 'pos.access')
  listDepartments(@CurrentUser() user: AuthenticatedUser) {
    return this.customersService.listDepartments(user.organizationId);
  }

  @Get('by-extension/:extension')
  @Permissions('customer.view', 'pos.access')
  findByExtension(@CurrentUser() user: AuthenticatedUser, @Param('extension') extension: string) {
    return this.customersService.findByExtension(user.organizationId, extension);
  }

  @Get(':id')
  @Permissions('customer.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.findOne(user.organizationId, id);
  }

  @Post()
  @Permissions('customer.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateCustomerDto) {
    return this.customersService.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @Permissions('customer.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(user.organizationId, user.id, id, dto);
  }

  @Delete(':id')
  @Permissions('customer.manage')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.customersService.remove(user.organizationId, user.id, id);
  }
}

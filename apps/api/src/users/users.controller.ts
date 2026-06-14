import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import {
  AssignRoleDto,
  ResetPinDto,
  SetUserBranchesDto,
  UpdateUserDto,
} from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Permissions('user.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findAll(user.organizationId);
  }

  @Get(':id')
  @Permissions('user.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.usersService.findOne(user.organizationId, id);
  }

  @Post()
  @Permissions('user.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateUserDto) {
    return this.usersService.create(user.organizationId, dto);
  }

  @Patch(':id')
  @Permissions('user.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(user.organizationId, user.id, id, dto);
  }

  @Patch(':id/role')
  @Permissions('user.manage', 'role.manage')
  assignRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
  ) {
    return this.usersService.assignRole(user.organizationId, user.id, id, dto);
  }

  @Put(':id/branches')
  @Permissions('user.manage')
  setBranches(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SetUserBranchesDto,
  ) {
    return this.usersService.setBranches(user.organizationId, user.id, id, dto);
  }

  @Post(':id/reset-pin')
  @Permissions('user.manage')
  resetPin(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ResetPinDto,
  ) {
    return this.usersService.resetPin(user.organizationId, user.id, id, dto);
  }
}

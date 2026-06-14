import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto, UpdateBranchDto, UpsertBranchSettingsDto } from './dto/branch.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('branches')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Get()
  @Permissions('branch.view')
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.branchesService.findAll(user.organizationId);
  }

  @Get(':id')
  @Permissions('branch.view')
  findOne(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.branchesService.findOne(user.organizationId, id);
  }

  @Post()
  @Permissions('branch.manage')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateBranchDto) {
    return this.branchesService.create(user.organizationId, user.id, dto);
  }

  @Patch(':id')
  @Permissions('branch.manage')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
  ) {
    return this.branchesService.update(user.organizationId, user.id, id, dto);
  }

  @Delete(':id')
  @Permissions('branch.manage')
  remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.branchesService.remove(user.organizationId, user.id, id);
  }

  @Get(':id/settings')
  @Permissions('branch.view')
  getSettings(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.branchesService.getSettings(user.organizationId, id);
  }

  @Put(':id/settings')
  @Permissions('branch.manage')
  upsertSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpsertBranchSettingsDto,
  ) {
    return this.branchesService.upsertSettings(user.organizationId, user.id, id, dto);
  }
}

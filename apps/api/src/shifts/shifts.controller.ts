import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CloseShiftDto, OpenShiftDto, ShiftCashEventDto } from './dto/shift.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('shifts')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Get()
  @Permissions('shift.open', 'shift.close', 'report.view', 'pos.access')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('limit') limit?: string,
  ) {
    return this.shiftsService.list(
      user.organizationId,
      branchId,
      limit ? parseInt(limit, 10) : undefined,
    );
  }

  @Post('open')
  @Permissions('shift.open', 'pos.access')
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenShiftDto) {
    return this.shiftsService.open(user.organizationId, user.id, dto);
  }

  @Get('current')
  @Permissions('shift.open', 'pos.access')
  current(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('terminalId') terminalId?: string,
  ) {
    return this.shiftsService.getCurrent(branchId, user.organizationId, terminalId);
  }

  @Post(':id/cash-events')
  @Permissions('shift.cash_event', 'pos.access')
  cashEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ShiftCashEventDto,
  ) {
    return this.shiftsService.addCashEvent(id, user.organizationId, user.id, dto);
  }

  @Post(':id/close')
  @Permissions('shift.close', 'pos.access')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.close(id, user.organizationId, user.id, dto);
  }

  @Get(':id/summary')
  @Permissions('shift.close', 'report.view', 'pos.access')
  summary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.shiftsService.getSummary(id, user.organizationId);
  }
}

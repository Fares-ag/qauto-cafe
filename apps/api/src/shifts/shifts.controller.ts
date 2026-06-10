import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ShiftsService } from './shifts.service';
import { CloseShiftDto, OpenShiftDto, ShiftCashEventDto } from './dto/shift.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('shifts')
@UseGuards(JwtAuthGuard)
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  open(@CurrentUser() user: AuthenticatedUser, @Body() dto: OpenShiftDto) {
    return this.shiftsService.open(user.organizationId, user.id, dto);
  }

  @Get('current')
  current(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('terminalId') terminalId?: string,
  ) {
    return this.shiftsService.getCurrent(branchId, user.organizationId, terminalId);
  }

  @Post(':id/cash-events')
  cashEvent(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: ShiftCashEventDto,
  ) {
    return this.shiftsService.addCashEvent(id, user.organizationId, user.id, dto);
  }

  @Post(':id/close')
  close(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: CloseShiftDto,
  ) {
    return this.shiftsService.close(id, user.organizationId, user.id, dto);
  }

  @Get(':id/summary')
  summary(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.shiftsService.getSummary(id, user.organizationId);
  }
}

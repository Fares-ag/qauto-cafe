import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { TerminalsService } from './terminals.service';
import { RegisterTerminalDto } from './dto/register-terminal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { TerminalRegisterGuard } from './terminal-register.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post('register')
  @UseGuards(TerminalRegisterGuard)
  register(@Body() dto: RegisterTerminalDto, @Req() req: Request) {
    const user = (req as Request & { user?: AuthenticatedUser }).user;
    return this.terminalsService.register(dto, user?.organizationId);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
  @Permissions('terminal.manage', 'pos.access', 'bar.access')
  list(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.terminalsService.listByBranch(branchId, user.organizationId);
  }
}

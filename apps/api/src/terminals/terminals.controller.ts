import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { TerminalsService } from './terminals.service';
import { RegisterTerminalDto } from './dto/register-terminal.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('terminals')
export class TerminalsController {
  constructor(private readonly terminalsService: TerminalsService) {}

  @Post('register')
  register(@Body() dto: RegisterTerminalDto) {
    return this.terminalsService.register(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  list(@Query('branchId') branchId: string) {
    return this.terminalsService.listByBranch(branchId);
  }
}

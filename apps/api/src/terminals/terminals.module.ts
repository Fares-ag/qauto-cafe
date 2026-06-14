import { Module } from '@nestjs/common';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';
import { CryptoService } from '../common/crypto.service';
import { TerminalRegisterGuard } from './terminal-register.guard';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TerminalsController],
  providers: [TerminalsService, CryptoService, TerminalRegisterGuard],
  exports: [TerminalsService],
})
export class TerminalsModule {}

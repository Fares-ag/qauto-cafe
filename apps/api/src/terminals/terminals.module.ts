import { Module } from '@nestjs/common';
import { TerminalsController } from './terminals.controller';
import { TerminalsService } from './terminals.service';
import { CryptoService } from '../common/crypto.service';

@Module({
  controllers: [TerminalsController],
  providers: [TerminalsService, CryptoService],
  exports: [TerminalsService],
})
export class TerminalsModule {}

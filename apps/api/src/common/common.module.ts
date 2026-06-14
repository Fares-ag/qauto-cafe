import { Global, Module } from '@nestjs/common';
import { BranchAccessService } from './services/branch-access.service';
import { BranchAccessGuard } from './guards/branch-access.guard';

@Global()
@Module({
  providers: [BranchAccessService, BranchAccessGuard],
  exports: [BranchAccessService, BranchAccessGuard],
})
export class CommonModule {}

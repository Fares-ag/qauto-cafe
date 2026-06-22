import { Global, Module } from '@nestjs/common';
import { BranchAccessService } from './services/branch-access.service';
import { BranchAccessGuard } from './guards/branch-access.guard';
import { OrderBranchAccessGuard } from './guards/order-branch-access.guard';

@Global()
@Module({
  providers: [BranchAccessService, BranchAccessGuard, OrderBranchAccessGuard],
  exports: [BranchAccessService, BranchAccessGuard, OrderBranchAccessGuard],
})
export class CommonModule {}

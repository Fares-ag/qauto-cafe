import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('loyalty')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LoyaltyController {
  constructor(private readonly loyaltyService: LoyaltyService) {}

  @Get('rewards')
  @Permissions('loyalty.manage', 'customer.view', 'pos.access')
  listRewards(@CurrentUser() user: AuthenticatedUser) {
    return this.loyaltyService.listRewards(user.organizationId);
  }

  @Get('accounts/:customerId')
  @Permissions('loyalty.manage', 'customer.view', 'pos.access')
  getAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Param('customerId') customerId: string,
  ) {
    return this.loyaltyService.getAccount(customerId, user.organizationId);
  }
}

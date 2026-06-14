import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { GiftCardsService } from './gift-cards.service';
import { IssueGiftCardDto } from './dto/gift-card.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('gift-cards')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class GiftCardsController {
  constructor(private readonly giftCardsService: GiftCardsService) {}

  @Post()
  @Permissions('customer.manage', 'payment.process')
  issue(@CurrentUser() user: AuthenticatedUser, @Body() dto: IssueGiftCardDto) {
    return this.giftCardsService.issue(user.organizationId, user.id, dto);
  }

  @Get(':code/balance')
  @Permissions('payment.process', 'customer.view', 'pos.access')
  getBalance(@CurrentUser() user: AuthenticatedUser, @Param('code') code: string) {
    return this.giftCardsService.getBalance(code, user.organizationId);
  }
}

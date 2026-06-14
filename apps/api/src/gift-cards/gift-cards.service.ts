import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { GiftCardStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { decimalToString } from '../common/utils/decimal.util';
import { IssueGiftCardDto } from './dto/gift-card.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class GiftCardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async issue(organizationId: string, userId: string, dto: IssueGiftCardDto) {
    const amount = new Prisma.Decimal(dto.amount);
    if (amount.lte(0)) throw new BadRequestException('Amount must be positive');

    if (dto.customerId) {
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.customerId, organizationId, deletedAt: null },
      });
      if (!customer) throw new NotFoundException('Customer not found');
    }

    const code = this.generateCode();
    const card = await this.prisma.giftCard.create({
      data: {
        code,
        organizationId,
        balance: amount,
        initialValue: amount,
        customerId: dto.customerId,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        status: 'ACTIVE',
      },
    });

    await this.audit.log({
      organizationId,
      userId,
      action: 'CREATE',
      entityType: 'gift_card',
      entityId: card.id,
      afterState: { code, amount: dto.amount },
    });

    return this.serialize(card);
  }

  async getBalance(code: string, organizationId: string) {
    const card = await this.findActiveCard(code, organizationId);
    return {
      code: card.code,
      balance: decimalToString(card.balance),
      status: card.status,
      expiresAt: card.expiresAt?.toISOString() ?? null,
    };
  }

  async redeem(
    tx: Prisma.TransactionClient,
    code: string,
    amount: Prisma.Decimal,
    orderId: string,
  ): Promise<Prisma.Decimal> {
    const card = await tx.giftCard.findUnique({ where: { code: code.toUpperCase() } });
    if (!card) throw new BadRequestException('Gift card not found');
    if (card.status !== 'ACTIVE') throw new BadRequestException('Gift card is not active');
    if (card.expiresAt && card.expiresAt < new Date()) {
      throw new BadRequestException('Gift card has expired');
    }
    if (card.balance.lt(amount)) {
      throw new BadRequestException(
        `Gift card balance ${decimalToString(card.balance)} insufficient for ${decimalToString(amount)}`,
      );
    }

    const newBalance = card.balance.sub(amount);
    await tx.giftCard.update({
      where: { id: card.id },
      data: {
        balance: newBalance,
        status: newBalance.lte(0) ? GiftCardStatus.DEPLETED : GiftCardStatus.ACTIVE,
      },
    });

    return amount;
  }

  private async findActiveCard(code: string, organizationId?: string) {
    const card = await this.prisma.giftCard.findFirst({
      where: {
        code: code.toUpperCase(),
        ...(organizationId ? { organizationId } : {}),
      },
    });
    if (!card) throw new NotFoundException('Gift card not found');
    if (card.status === 'CANCELLED') throw new BadRequestException('Gift card cancelled');
    if (card.expiresAt && card.expiresAt < new Date()) {
      throw new BadRequestException('Gift card expired');
    }
    return card;
  }

  private generateCode(): string {
    return `GC-${randomBytes(4).toString('hex').toUpperCase()}`;
  }

  private serialize(card: {
    id: string;
    code: string;
    balance: Prisma.Decimal;
    initialValue: Prisma.Decimal;
    status: GiftCardStatus;
    customerId: string | null;
    expiresAt: Date | null;
    createdAt: Date;
  }) {
    return {
      id: card.id,
      code: card.code,
      balance: decimalToString(card.balance),
      initialValue: decimalToString(card.initialValue),
      status: card.status,
      customerId: card.customerId,
      expiresAt: card.expiresAt?.toISOString() ?? null,
      createdAt: card.createdAt.toISOString(),
    };
  }
}

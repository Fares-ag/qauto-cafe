import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToString } from '../common/utils/decimal.util';

/** 1 point earned per 1 QAR spent; 100 points = 1 QAR discount when redeeming */
const POINTS_PER_QAR = 1;
const QAR_PER_100_POINTS = 1;

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async listRewards(organizationId: string) {
    const rewards = await this.prisma.reward.findMany({
      where: { organizationId, isActive: true, deletedAt: null },
      orderBy: { pointsCost: 'asc' },
    });
    return rewards.map((r) => ({
      id: r.id,
      name: r.name,
      pointsCost: r.pointsCost,
      isActive: r.isActive,
    }));
  }

  async getAccount(customerId: string, organizationId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, organizationId, deletedAt: null },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    let account = await this.prisma.loyaltyAccount.findUnique({
      where: { customerId },
      include: { customer: { select: { id: true, firstName: true, lastName: true } } },
    });

    if (!account) {
      account = await this.prisma.loyaltyAccount.create({
        data: { customerId },
        include: { customer: { select: { id: true, firstName: true, lastName: true } } },
      });
    }

    return {
      customerId: account.customerId,
      pointsBalance: account.pointsBalance,
      lifetimePoints: account.lifetimePoints,
    };
  }

  async earnOnPayment(
    tx: Prisma.TransactionClient,
    customerId: string,
    orderId: string,
    orderTotal: Prisma.Decimal,
  ) {
    const points = Math.floor(orderTotal.toNumber() * POINTS_PER_QAR);
    if (points <= 0) return 0;

    let account = await tx.loyaltyAccount.findUnique({ where: { customerId } });
    if (!account) {
      account = await tx.loyaltyAccount.create({ data: { customerId } });
    }

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: { increment: points },
        lifetimePoints: { increment: points },
      },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: 'EARN',
        points,
        referenceType: 'order',
        referenceId: orderId,
        notes: `Earned from order payment`,
      },
    });

    return points;
  }

  async redeemPoints(
    tx: Prisma.TransactionClient,
    customerId: string,
    orderId: string,
    pointsToRedeem: number,
  ): Promise<Prisma.Decimal> {
    if (pointsToRedeem <= 0) return new Prisma.Decimal(0);

    const account = await tx.loyaltyAccount.findUnique({ where: { customerId } });
    if (!account) throw new BadRequestException('Customer has no loyalty account');
    if (account.pointsBalance < pointsToRedeem) {
      throw new BadRequestException(`Insufficient points: have ${account.pointsBalance}, need ${pointsToRedeem}`);
    }

    const discountAmount = new Prisma.Decimal((pointsToRedeem / 100) * QAR_PER_100_POINTS);

    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: { pointsBalance: { decrement: pointsToRedeem } },
    });

    await tx.loyaltyTransaction.create({
      data: {
        accountId: account.id,
        type: 'REDEEM',
        points: -pointsToRedeem,
        referenceType: 'order',
        referenceId: orderId,
        notes: `Redeemed at checkout`,
      },
    });

    return discountAmount;
  }

  async redeemReward(
    tx: Prisma.TransactionClient,
    customerId: string,
    orderId: string,
    rewardId: string,
  ): Promise<{ pointsCost: number; discountAmount: Prisma.Decimal }> {
    const reward = await tx.reward.findFirst({
      where: { id: rewardId, isActive: true, deletedAt: null },
    });
    if (!reward) throw new NotFoundException('Reward not found');

    const discountAmount = await this.redeemPoints(tx, customerId, orderId, reward.pointsCost);
    return { pointsCost: reward.pointsCost, discountAmount };
  }
}

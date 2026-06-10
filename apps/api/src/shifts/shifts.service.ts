import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentMethodType, Prisma, ShiftCashEventType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToString } from '../common/utils/decimal.util';
import { DomainEventsService } from '../events/domain-events.service';
import { CloseShiftDto, OpenShiftDto, ShiftCashEventDto } from './dto/shift.dto';

@Injectable()
export class ShiftsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  async open(organizationId: string, userId: string, dto: OpenShiftDto) {
    await this.assertBranch(organizationId, dto.branchId);

    if (dto.terminalId) {
      const existing = await this.prisma.shift.findFirst({
        where: { branchId: dto.branchId, terminalId: dto.terminalId, status: 'OPEN' },
      });
      if (existing) {
        throw new ConflictException('This terminal already has an open shift');
      }
    }

    const shift = await this.prisma.$transaction(async (tx) => {
      const created = await tx.shift.create({
        data: {
          branchId: dto.branchId,
          terminalId: dto.terminalId,
          openedById: userId,
          openingFloat: dto.openingFloat,
          notes: dto.notes,
          status: 'OPEN',
        },
      });

      await tx.shiftCashEvent.create({
        data: {
          shiftId: created.id,
          type: ShiftCashEventType.OPEN_FLOAT,
          amount: dto.openingFloat,
          createdById: userId,
        },
      });

      return created;
    });

    this.domainEvents.emitShiftOpened(dto.branchId, {
      shiftId: shift.id,
      branchId: shift.branchId,
      terminalId: shift.terminalId,
      openingFloat: decimalToString(shift.openingFloat),
      openedAt: shift.openedAt.toISOString(),
    });

    return this.getShift(shift.id, organizationId);
  }

  async getCurrent(branchId: string, organizationId: string, terminalId?: string) {
    await this.assertBranch(organizationId, branchId);

    const shift = await this.prisma.shift.findFirst({
      where: {
        branchId,
        status: 'OPEN',
        ...(terminalId ? { terminalId } : {}),
      },
      include: { cashEvents: { orderBy: { createdAt: 'asc' } } },
      orderBy: { openedAt: 'desc' },
    });

    if (!shift) {
      return null;
    }

    return this.serializeShift(shift);
  }

  async addCashEvent(
    shiftId: string,
    organizationId: string,
    userId: string,
    dto: ShiftCashEventDto,
  ) {
    const shift = await this.getOpenShift(shiftId, organizationId);

    if (dto.type === ShiftCashEventType.OPEN_FLOAT) {
      throw new BadRequestException('Use shift open for opening float');
    }

    await this.prisma.shiftCashEvent.create({
      data: {
        shiftId: shift.id,
        type: dto.type,
        amount: dto.amount,
        reason: dto.reason,
        createdById: userId,
      },
    });

    return this.getShift(shift.id, organizationId);
  }

  async close(shiftId: string, organizationId: string, userId: string, dto: CloseShiftDto) {
    const shift = await this.getOpenShift(shiftId, organizationId);
    const expectedCash = await this.calculateExpectedCash(shift.id, shift.openingFloat);

    const actualCash = new Prisma.Decimal(dto.actualCash);
    const variance = actualCash.sub(expectedCash);

    const closed = await this.prisma.$transaction(async (tx) => {
      await tx.shiftCashEvent.create({
        data: {
          shiftId: shift.id,
          type: ShiftCashEventType.CLOSE_COUNT,
          amount: dto.actualCash,
          reason: dto.notes,
          createdById: userId,
        },
      });

      return tx.shift.update({
        where: { id: shift.id },
        data: {
          status: 'CLOSED',
          closedById: userId,
          expectedCash,
          actualCash,
          cashVariance: variance,
          closedAt: new Date(),
          notes: dto.notes ?? shift.notes,
        },
        include: { cashEvents: { orderBy: { createdAt: 'asc' } } },
      });
    });

    this.domainEvents.emitShiftClosed(shift.branchId, {
      shiftId: closed.id,
      branchId: closed.branchId,
      expectedCash: decimalToString(expectedCash),
      actualCash: decimalToString(actualCash),
      cashVariance: decimalToString(variance),
      closedAt: closed.closedAt!.toISOString(),
    });

    return this.serializeShift(closed);
  }

  async getSummary(shiftId: string, organizationId: string) {
    const shift = await this.getShift(shiftId, organizationId);

    const orders = await this.prisma.order.findMany({
      where: { shiftId: shift.id, status: { in: ['PAID', 'IN_PREP', 'READY', 'COMPLETED'] } },
      include: { payments: true },
    });

    const voidCount = await this.prisma.order.count({
      where: { shiftId: shift.id, status: 'VOIDED' },
    });

    let grossSales = new Prisma.Decimal(0);
    let cashSales = new Prisma.Decimal(0);
    let cardSales = new Prisma.Decimal(0);

    for (const order of orders) {
      grossSales = grossSales.add(order.total);
      for (const payment of order.payments) {
        if (payment.method === PaymentMethodType.CASH) {
          cashSales = cashSales.add(payment.amount);
        } else if (payment.method === PaymentMethodType.CARD) {
          cardSales = cardSales.add(payment.amount);
        }
      }
    }

    return {
      shift,
      orderCount: orders.length,
      grossSales: decimalToString(grossSales),
      cashSales: decimalToString(cashSales),
      cardSales: decimalToString(cardSales),
      voidCount,
    };
  }

  private async calculateExpectedCash(shiftId: string, openingFloat: Prisma.Decimal) {
    const orders = await this.prisma.order.findMany({
      where: { shiftId, status: { in: ['PAID', 'IN_PREP', 'READY', 'COMPLETED'] } },
      include: { payments: { where: { status: 'COMPLETED' } } },
    });

    let cashIn = new Prisma.Decimal(0);
    for (const order of orders) {
      for (const payment of order.payments) {
        if (payment.method === PaymentMethodType.CASH) {
          cashIn = cashIn.add(payment.amount);
        }
      }
    }

    const events = await this.prisma.shiftCashEvent.findMany({ where: { shiftId } });
    let adjustments = new Prisma.Decimal(0);

    for (const event of events) {
      if (event.type === ShiftCashEventType.PAID_IN || event.type === ShiftCashEventType.OPEN_FLOAT) {
        if (event.type !== ShiftCashEventType.OPEN_FLOAT) {
          adjustments = adjustments.add(event.amount);
        }
      } else if (event.type === ShiftCashEventType.PAID_OUT || event.type === ShiftCashEventType.DROP) {
        adjustments = adjustments.sub(event.amount);
      }
    }

    return openingFloat.add(cashIn).add(adjustments);
  }

  private async getOpenShift(shiftId: string, organizationId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId, status: 'OPEN' },
      include: { branch: { select: { organizationId: true } } },
    });

    if (!shift || shift.branch.organizationId !== organizationId) {
      throw new NotFoundException('Open shift not found');
    }

    return shift;
  }

  private async getShift(shiftId: string, organizationId: string) {
    const shift = await this.prisma.shift.findFirst({
      where: { id: shiftId },
      include: {
        branch: true,
        cashEvents: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!shift || shift.branch.organizationId !== organizationId) {
      throw new NotFoundException('Shift not found');
    }

    return this.serializeShift(shift);
  }

  private async assertBranch(organizationId: string, branchId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null, isActive: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
  }

  private serializeShift(
    shift: {
      id: string;
      branchId: string;
      terminalId: string | null;
      status: string;
      openingFloat: Prisma.Decimal;
      expectedCash: Prisma.Decimal | null;
      actualCash: Prisma.Decimal | null;
      cashVariance: Prisma.Decimal | null;
      openedAt: Date;
      closedAt: Date | null;
      notes: string | null;
      cashEvents?: Array<{
        id: string;
        type: string;
        amount: Prisma.Decimal;
        reason: string | null;
        createdAt: Date;
      }>;
    },
  ) {
    return {
      id: shift.id,
      branchId: shift.branchId,
      terminalId: shift.terminalId,
      status: shift.status,
      openingFloat: decimalToString(shift.openingFloat),
      expectedCash: shift.expectedCash ? decimalToString(shift.expectedCash) : null,
      actualCash: shift.actualCash ? decimalToString(shift.actualCash) : null,
      cashVariance: shift.cashVariance ? decimalToString(shift.cashVariance) : null,
      openedAt: shift.openedAt.toISOString(),
      closedAt: shift.closedAt?.toISOString() ?? null,
      notes: shift.notes,
      cashEvents: shift.cashEvents?.map((event) => ({
        id: event.id,
        type: event.type,
        amount: decimalToString(event.amount),
        reason: event.reason,
        createdAt: event.createdAt.toISOString(),
      })),
    };
  }
}

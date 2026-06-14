import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { decimalToString } from '../common/utils/decimal.util';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailySales(branchId: string, organizationId: string, businessDate: string) {
    await this.assertBranch(branchId, organizationId);
    const date = this.parseDate(businessDate);

    const row = await this.prisma.dailySalesSummary.findUnique({
      where: { branchId_businessDate: { branchId, businessDate: date } },
    });

    if (!row) {
      return this.emptyDailySales(branchId, businessDate);
    }

    return {
      branchId: row.branchId,
      businessDate: businessDate,
      orderCount: row.orderCount,
      grossSales: decimalToString(row.grossSales),
      netSales: decimalToString(row.netSales),
      discountTotal: decimalToString(row.discountTotal),
      taxTotal: decimalToString(row.taxTotal),
      cogsTotal: decimalToString(row.cogsTotal),
      cashTotal: decimalToString(row.cashTotal),
      cardTotal: decimalToString(row.cardTotal),
      corporateTotal: decimalToString(row.corporateTotal),
      otherTotal: decimalToString(row.otherTotal),
      tipTotal: decimalToString(row.tipTotal),
      voidCount: row.voidCount,
      refundTotal: decimalToString(row.refundTotal),
      drinkSales: decimalToString(row.drinkSales),
      snackSales: decimalToString(row.snackSales),
      refreshedAt: row.refreshedAt.toISOString(),
    };
  }

  async getProductPerformance(branchId: string, organizationId: string, businessDate: string) {
    await this.assertBranch(branchId, organizationId);
    const date = this.parseDate(businessDate);

    const rows = await this.prisma.productSalesSummary.findMany({
      where: { branchId, businessDate: date },
      include: { menuItem: true },
      orderBy: { grossSales: 'desc' },
    });

    return rows.map((row) => ({
      menuItemId: row.menuItemId,
      menuItemName: row.menuItem.name,
      businessDate,
      quantitySold: row.quantitySold,
      grossSales: decimalToString(row.grossSales),
      cogsTotal: decimalToString(row.cogsTotal),
    }));
  }

  async getIngredientUsage(branchId: string, organizationId: string, businessDate: string) {
    await this.assertBranch(branchId, organizationId);
    const date = this.parseDate(businessDate);

    const rows = await this.prisma.ingredientUsageSummary.findMany({
      where: { branchId, businessDate: date },
      include: { ingredient: true },
      orderBy: { valueUsed: 'desc' },
    });

    return rows.map((row) => ({
      ingredientId: row.ingredientId,
      ingredientName: row.ingredient.name,
      businessDate,
      quantityUsed: decimalToString(row.quantityUsed),
      uomCode: row.uomCode,
      valueUsed: decimalToString(row.valueUsed),
    }));
  }

  async getEmployeeActivity(branchId: string, organizationId: string, businessDate: string) {
    await this.assertBranch(branchId, organizationId);
    const date = this.parseDate(businessDate);

    const rows = await this.prisma.employeeActivitySummary.findMany({
      where: { branchId, businessDate: date },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      orderBy: { grossSales: 'desc' },
    });

    return rows.map((row) => ({
      userId: row.userId,
      userName: `${row.user.firstName} ${row.user.lastName}`,
      businessDate,
      ordersHandled: row.ordersHandled,
      grossSales: decimalToString(row.grossSales),
      voidCount: row.voidCount,
      refundTotal: decimalToString(row.refundTotal),
      discountTotal: decimalToString(row.discountTotal),
    }));
  }

  async getWasteAnalytics(branchId: string, organizationId: string, businessDate: string) {
    await this.assertBranch(branchId, organizationId);
    const date = this.parseDate(businessDate);
    const nextDate = new Date(date);
    nextDate.setUTCDate(nextDate.getUTCDate() + 1);

    const movements = await this.prisma.stockMovement.findMany({
      where: {
        branchId,
        type: 'WASTE',
        createdAt: { gte: date, lt: nextDate },
      },
      include: {
        ingredient: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const wasteRecords = await this.prisma.wasteRecord.findMany({
      where: {
        branchId,
        createdAt: { gte: date, lt: nextDate },
      },
      include: {
        ingredient: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byIngredient = new Map<
      string,
      { ingredientId: string; ingredientName: string; quantity: Prisma.Decimal; value: Prisma.Decimal; count: number }
    >();

    for (const m of movements) {
      const key = m.ingredientId;
      const existing = byIngredient.get(key) ?? {
        ingredientId: m.ingredientId,
        ingredientName: m.ingredient.name,
        quantity: new Prisma.Decimal(0),
        value: new Prisma.Decimal(0),
        count: 0,
      };
      existing.quantity = existing.quantity.add(m.quantity.abs());
      existing.value = existing.value.add(m.extendedCost.abs());
      existing.count += 1;
      byIngredient.set(key, existing);
    }

    const totalValue = [...byIngredient.values()].reduce(
      (acc, row) => acc.add(row.value),
      new Prisma.Decimal(0),
    );

    return {
      branchId,
      businessDate,
      totalRecords: wasteRecords.length,
      totalValue: decimalToString(totalValue),
      byIngredient: [...byIngredient.values()]
        .sort((a, b) => b.value.sub(a.value).toNumber())
        .map((row) => ({
          ingredientId: row.ingredientId,
          ingredientName: row.ingredientName,
          quantityWasted: decimalToString(row.quantity),
          valueWasted: decimalToString(row.value),
          eventCount: row.count,
        })),
      recent: wasteRecords.slice(0, 20).map((r) => ({
        id: r.id,
        ingredientName: r.ingredient.name,
        quantity: decimalToString(r.quantity),
        reason: r.reason,
        createdAt: r.createdAt.toISOString(),
      })),
    };
  }

  async getUnpaidOrders(branchId: string, organizationId: string) {
    await this.assertBranch(branchId, organizationId);

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        OR: [
          { status: 'PENDING_PAYMENT' },
          {
            deferredAt: { not: null },
            paidAt: null,
            status: { notIn: ['VOIDED', 'REFUNDED', 'DRAFT'] },
          },
        ],
      },
      orderBy: [{ deferredAt: 'asc' }, { orderNumber: 'asc' }],
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerName: true,
        customerDepartment: true,
        total: true,
        deferredAt: true,
        paymentDueDate: true,
      },
    });

    const outstandingTotal = orders.reduce(
      (acc, o) => acc.add(o.total),
      new Prisma.Decimal(0),
    );

    return {
      branchId,
      orderCount: orders.length,
      outstandingTotal: decimalToString(outstandingTotal),
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        customerName: o.customerName,
        customerDepartment: o.customerDepartment,
        total: decimalToString(o.total),
        deferredAt: o.deferredAt?.toISOString() ?? null,
        paymentDueDate: o.paymentDueDate?.toISOString().slice(0, 10) ?? null,
      })),
    };
  }

  async getDashboardAnalytics(
    branchId: string,
    organizationId: string,
    businessDate: string,
    trendDays = 7,
  ) {
    await this.assertBranch(branchId, organizationId);
    const date = this.parseDate(businessDate);

    const [daily, hourly, orderTypes, trendRows] = await Promise.all([
      this.getDailySales(branchId, organizationId, businessDate),
      this.prisma.hourlySalesSummary.findMany({
        where: { branchId, businessDate: date },
        orderBy: { hour: 'asc' },
      }),
      this.prisma.orderTypeSummary.findMany({
        where: { branchId, businessDate: date },
        orderBy: { netSales: 'desc' },
      }),
      this.prisma.dailySalesSummary.findMany({
        where: {
          branchId,
          businessDate: {
            gte: new Date(date.getTime() - (trendDays - 1) * 86400000),
            lte: date,
          },
        },
        orderBy: { businessDate: 'asc' },
      }),
    ]);

    const net = parseFloat(daily.netSales);
    const cogs = parseFloat(daily.cogsTotal);
    const marginPct = net > 0 ? ((net - cogs) / net) * 100 : 0;
    const avgTicket = daily.orderCount > 0 ? net / daily.orderCount : 0;

    return {
      businessDate,
      kpis: {
        ...daily,
        marginPct: marginPct.toFixed(1),
        avgTicket: avgTicket.toFixed(4),
        foodCostPct: net > 0 ? ((cogs / net) * 100).toFixed(1) : '0.0',
      },
      hourly: hourly.map((h) => ({
        hour: h.hour,
        label: `${String(h.hour).padStart(2, '0')}:00`,
        orderCount: h.orderCount,
        netSales: decimalToString(h.netSales),
      })),
      orderTypes: orderTypes.map((o) => ({
        orderType: o.orderType,
        orderCount: o.orderCount,
        netSales: decimalToString(o.netSales),
      })),
      paymentMix: [
        { method: 'Cash', amount: daily.cashTotal },
        { method: 'Card', amount: daily.cardTotal },
        { method: 'Corporate', amount: daily.corporateTotal },
        { method: 'Other', amount: daily.otherTotal },
      ].filter((p) => parseFloat(p.amount) > 0),
      categoryMix: [
        { category: 'Drinks', amount: daily.drinkSales },
        { category: 'Snacks', amount: daily.snackSales },
      ].filter((c) => parseFloat(c.amount) > 0),
      trend: trendRows.map((r) => ({
        businessDate: r.businessDate.toISOString().slice(0, 10),
        netSales: decimalToString(r.netSales),
        orderCount: r.orderCount,
        cogsTotal: decimalToString(r.cogsTotal),
      })),
    };
  }

  async getArAging(branchId: string, organizationId: string) {
    await this.assertBranch(branchId, organizationId);
    const unpaid = await this.getUnpaidOrders(branchId, organizationId);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const buckets = {
      current: { label: 'Not due', count: 0, total: new Prisma.Decimal(0) },
      days1_7: { label: '1–7 days overdue', count: 0, total: new Prisma.Decimal(0) },
      days8_30: { label: '8–30 days overdue', count: 0, total: new Prisma.Decimal(0) },
      over30: { label: '30+ days overdue', count: 0, total: new Prisma.Decimal(0) },
    };

    const byDepartment = new Map<string, { department: string; count: number; total: Prisma.Decimal }>();

    for (const order of unpaid.orders) {
      const total = new Prisma.Decimal(order.total);
      const due = order.paymentDueDate ? new Date(`${order.paymentDueDate}T00:00:00.000Z`) : null;
      let bucket: keyof typeof buckets = 'current';
      if (due && due < now) {
        const days = Math.floor((now.getTime() - due.getTime()) / 86400000);
        if (days <= 7) bucket = 'days1_7';
        else if (days <= 30) bucket = 'days8_30';
        else bucket = 'over30';
      }
      buckets[bucket].count += 1;
      buckets[bucket].total = buckets[bucket].total.add(total);

      const dept = order.customerDepartment ?? 'Unassigned';
      const existing = byDepartment.get(dept) ?? { department: dept, count: 0, total: new Prisma.Decimal(0) };
      existing.count += 1;
      existing.total = existing.total.add(total);
      byDepartment.set(dept, existing);
    }

    return {
      branchId,
      outstandingTotal: unpaid.outstandingTotal,
      orderCount: unpaid.orderCount,
      buckets: Object.values(buckets).map((b) => ({
        label: b.label,
        count: b.count,
        total: decimalToString(b.total),
      })),
      byDepartment: [...byDepartment.values()]
        .sort((a, b) => b.total.sub(a.total).toNumber())
        .map((d) => ({
          department: d.department,
          count: d.count,
          total: decimalToString(d.total),
        })),
    };
  }

  async getLoyaltySummary(branchId: string, organizationId: string) {
    await this.assertBranch(branchId, organizationId);

    const accounts = await this.prisma.loyaltyAccount.findMany({
      where: { customer: { organizationId, deletedAt: null } },
      include: {
        transactions: {
          where: { createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
        },
      },
    });

    let pointsIssued = 0;
    let pointsRedeemed = 0;
    for (const account of accounts) {
      for (const tx of account.transactions) {
        if (tx.type === 'EARN') pointsIssued += tx.points;
        if (tx.type === 'REDEEM') pointsRedeemed += Math.abs(tx.points);
      }
    }

    const totalBalance = accounts.reduce((acc, a) => acc + a.pointsBalance, 0);

    return {
      branchId,
      activeAccounts: accounts.filter((a) => a.pointsBalance > 0).length,
      totalPointsBalance: totalBalance,
      pointsIssued30d: pointsIssued,
      pointsRedeemed30d: pointsRedeemed,
      liabilityQar: (totalBalance / 100).toFixed(4),
    };
  }

  async getSalesRange(
    branchId: string,
    organizationId: string,
    fromDate: string,
    toDate: string,
  ) {
    await this.assertBranch(branchId, organizationId);
    const from = this.parseDate(fromDate);
    const to = this.parseDate(toDate);

    const rows = await this.prisma.dailySalesSummary.findMany({
      where: { branchId, businessDate: { gte: from, lte: to } },
      orderBy: { businessDate: 'asc' },
    });

    return rows.map((r) => ({
      businessDate: r.businessDate.toISOString().slice(0, 10),
      orderCount: r.orderCount,
      grossSales: decimalToString(r.grossSales),
      netSales: decimalToString(r.netSales),
      cogsTotal: decimalToString(r.cogsTotal),
      discountTotal: decimalToString(r.discountTotal),
      taxTotal: decimalToString(r.taxTotal),
      refundTotal: decimalToString(r.refundTotal),
    }));
  }

  private emptyDailySales(branchId: string, businessDate: string) {
    return {
      branchId,
      businessDate,
      orderCount: 0,
      grossSales: '0.0000',
      netSales: '0.0000',
      discountTotal: '0.0000',
      taxTotal: '0.0000',
      cogsTotal: '0.0000',
      cashTotal: '0.0000',
      cardTotal: '0.0000',
      corporateTotal: '0.0000',
      otherTotal: '0.0000',
      tipTotal: '0.0000',
      voidCount: 0,
      refundTotal: '0.0000',
      drinkSales: '0.0000',
      snackSales: '0.0000',
      refreshedAt: new Date().toISOString(),
    };
  }

  private parseDate(value: string) {
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) {
      throw new NotFoundException('Invalid business date');
    }
    return date;
  }

  async getOrganizationDashboard(organizationId: string, businessDate: string, trendDays = 7) {
    const branches = await this.prisma.branch.findMany({
      where: { organizationId, deletedAt: null, isActive: true },
      select: { id: true, name: true, code: true },
    });

    const branchSummaries = await Promise.all(
      branches.map(async (branch) => {
        const dashboard = await this.getDashboardAnalytics(
          branch.id,
          organizationId,
          businessDate,
          trendDays,
        );
        return {
          branchId: branch.id,
          branchName: branch.name,
          branchCode: branch.code,
          kpis: dashboard.kpis,
        };
      }),
    );

    const totals = branchSummaries.reduce(
      (acc, row) => {
        acc.netSales += parseFloat(row.kpis.netSales);
        acc.orderCount += row.kpis.orderCount;
        acc.refundTotal += parseFloat(row.kpis.refundTotal);
        return acc;
      },
      { netSales: 0, orderCount: 0, refundTotal: 0 },
    );

    return {
      businessDate,
      branchCount: branches.length,
      totals: {
        netSales: totals.netSales.toFixed(4),
        orderCount: totals.orderCount,
        refundTotal: totals.refundTotal.toFixed(4),
      },
      branches: branchSummaries,
    };
  }

  private async assertBranch(branchId: string, organizationId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null, isActive: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
  }
}

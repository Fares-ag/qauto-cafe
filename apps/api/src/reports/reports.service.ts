import { Injectable, NotFoundException } from '@nestjs/common';
import { BillingParty, Prisma } from '@prisma/client';
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

    return branch;
  }

  async getPnlAnalytics(
    branchId: string,
    organizationId: string,
    fromDate: string,
    toDate: string,
  ) {
    await this.assertBranch(branchId, organizationId);
    const from = this.parseDate(fromDate);
    const to = this.parseDate(toDate);

    const dailyRows = await this.prisma.dailySalesSummary.findMany({
      where: { branchId, businessDate: { gte: from, lte: to } },
      orderBy: { businessDate: 'asc' },
    });

    const sumDec = (pick: (r: (typeof dailyRows)[0]) => Prisma.Decimal) =>
      decimalToString(
        dailyRows.reduce((acc, r) => acc.add(pick(r)), new Prisma.Decimal(0)),
      );

    const grossSales = sumDec((r) => r.grossSales);
    const netSales = sumDec((r) => r.netSales);
    const discountTotal = sumDec((r) => r.discountTotal);
    const taxTotal = sumDec((r) => r.taxTotal);
    const refundTotal = sumDec((r) => r.refundTotal);
    const cogsTotal = sumDec((r) => r.cogsTotal);
    const voidCount = dailyRows.reduce((acc, r) => acc + r.voidCount, 0);
    const orderCount = dailyRows.reduce((acc, r) => acc + r.orderCount, 0);

    const net = parseFloat(netSales);
    const cogs = parseFloat(cogsTotal);
    const contributionMargin = (net - cogs).toFixed(4);
    const marginPct = net > 0 ? (((net - cogs) / net) * 100).toFixed(1) : '0.0';
    const avgTicket = orderCount > 0 ? (net / orderCount).toFixed(4) : '0.0000';

    const [itemAgg, unpaid] = await Promise.all([
      this.prisma.orderLine.aggregate({
        where: {
          order: {
            branchId,
            organizationId,
            businessDate: { gte: from, lte: to },
            status: { notIn: ['DRAFT', 'VOIDED'] },
          },
        },
        _sum: { quantity: true },
      }),
      this.getUnpaidOrders(branchId, organizationId),
    ]);

    const lineQty = itemAgg._sum.quantity ?? 0;
    const avgItemsPerOrder =
      orderCount > 0 ? (lineQty / orderCount).toFixed(2) : '0.00';

    let deferredCreatedInPeriod = new Prisma.Decimal(0);
    let deferredCollectedInPeriod = new Prisma.Decimal(0);
    let deferredCount = 0;
    let collectedCount = 0;

    const deferredOrders = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        deferredAt: { gte: from, lte: new Date(to.getTime() + 86400000 - 1) },
      },
      select: { total: true, paidAt: true },
    });
    for (const o of deferredOrders) {
      deferredCount += 1;
      deferredCreatedInPeriod = deferredCreatedInPeriod.add(o.total);
      if (o.paidAt) {
        collectedCount += 1;
        deferredCollectedInPeriod = deferredCollectedInPeriod.add(o.total);
      }
    }

    const productRows = await this.prisma.productSalesSummary.findMany({
      where: { branchId, businessDate: { gte: from, lte: to } },
      include: {
        menuItem: { include: { category: { select: { name: true } } } },
      },
    });

    const skuMap = new Map<
      string,
      {
        menuItemId: string;
        menuItemName: string;
        category: string;
        quantitySold: number;
        grossSales: Prisma.Decimal;
        cogsTotal: Prisma.Decimal;
      }
    >();
    const catMap = new Map<
      string,
      { quantitySold: number; grossSales: Prisma.Decimal; cogsTotal: Prisma.Decimal }
    >();

    for (const row of productRows) {
      const cat = row.menuItem.category.name;
      const catEntry = catMap.get(cat) ?? {
        quantitySold: 0,
        grossSales: new Prisma.Decimal(0),
        cogsTotal: new Prisma.Decimal(0),
      };
      catEntry.quantitySold += row.quantitySold;
      catEntry.grossSales = catEntry.grossSales.add(row.grossSales);
      catEntry.cogsTotal = catEntry.cogsTotal.add(row.cogsTotal);
      catMap.set(cat, catEntry);

      const sku = skuMap.get(row.menuItemId) ?? {
        menuItemId: row.menuItemId,
        menuItemName: row.menuItem.name,
        category: cat,
        quantitySold: 0,
        grossSales: new Prisma.Decimal(0),
        cogsTotal: new Prisma.Decimal(0),
      };
      sku.quantitySold += row.quantitySold;
      sku.grossSales = sku.grossSales.add(row.grossSales);
      sku.cogsTotal = sku.cogsTotal.add(row.cogsTotal);
      skuMap.set(row.menuItemId, sku);
    }

    const mapMargin = (gross: Prisma.Decimal, cogsVal: Prisma.Decimal) => {
      const g = gross.toNumber();
      const c = cogsVal.toNumber();
      const margin = g - c;
      return { margin: margin.toFixed(4), marginPct: g > 0 ? ((margin / g) * 100).toFixed(1) : '0.0' };
    };

    return {
      branchId,
      fromDate,
      toDate,
      summary: {
        grossSales,
        netSales,
        discountTotal,
        taxTotal,
        refundTotal,
        voidCount,
        cogsTotal,
        contributionMargin,
        marginPct,
        orderCount,
        avgTicket,
        avgItemsPerOrder,
      },
      paymentTenders: {
        cash: sumDec((r) => r.cashTotal),
        card: sumDec((r) => r.cardTotal),
        corporate: sumDec((r) => r.corporateTotal),
        other: sumDec((r) => r.otherTotal),
        deferredOutstanding: unpaid.outstandingTotal,
        deferredCreatedInPeriod: decimalToString(deferredCreatedInPeriod),
        deferredCollectedInPeriod: decimalToString(deferredCollectedInPeriod),
      },
      dailyTrend: dailyRows.map((r) => ({
        businessDate: r.businessDate.toISOString().slice(0, 10),
        grossSales: decimalToString(r.grossSales),
        netSales: decimalToString(r.netSales),
        cashTotal: decimalToString(r.cashTotal),
        cardTotal: decimalToString(r.cardTotal),
        orderCount: r.orderCount,
      })),
      marginByCategory: [...catMap.entries()]
        .map(([category, v]) => {
          const m = mapMargin(v.grossSales, v.cogsTotal);
          return {
            category,
            quantitySold: v.quantitySold,
            grossSales: decimalToString(v.grossSales),
            cogsTotal: decimalToString(v.cogsTotal),
            margin: m.margin,
            marginPct: m.marginPct,
          };
        })
        .sort((a, b) => parseFloat(b.grossSales) - parseFloat(a.grossSales)),
      marginBySku: [...skuMap.values()]
        .map((v) => {
          const m = mapMargin(v.grossSales, v.cogsTotal);
          return {
            menuItemId: v.menuItemId,
            menuItemName: v.menuItemName,
            category: v.category,
            quantitySold: v.quantitySold,
            grossSales: decimalToString(v.grossSales),
            cogsTotal: decimalToString(v.cogsTotal),
            margin: m.margin,
            marginPct: m.marginPct,
          };
        })
        .sort((a, b) => parseFloat(b.grossSales) - parseFloat(a.grossSales)),
    };
  }

  async getCorporateBilling(
    branchId: string,
    organizationId: string,
    fromDate: string,
    toDate: string,
  ) {
    await this.assertBranch(branchId, organizationId);
    const from = this.parseDate(fromDate);
    const toEnd = new Date(toDate + 'T23:59:59.999Z');

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        businessDate: { gte: from, lte: this.parseDate(toDate) },
        status: { notIn: ['DRAFT', 'VOIDED'] },
      },
      include: {
        customer: { select: { id: true, firstName: true, lastName: true, phoneExtension: true, department: true } },
        refunds: { where: { status: 'COMPLETED' } },
      },
    });

    const partyMap = new Map<string, { orderCount: number; total: Prisma.Decimal }>();
    const deptMap = new Map<string, { orderCount: number; total: Prisma.Decimal }>();
    const staffMap = new Map<
      string,
      {
        customerId: string | null;
        name: string;
        department: string | null;
        phoneExtension: string | null;
        orderCount: number;
        total: Prisma.Decimal;
      }
    >();

    let officeGuestOrders = 0;
    let namedStaffOrders = 0;
    let walkInOrders = 0;
    let writeOffTotal = new Prisma.Decimal(0);
    let refundTotal = new Prisma.Decimal(0);

    for (const o of orders) {
      refundTotal = refundTotal.add(
        o.refunds.reduce((acc, r) => acc.add(r.amount), new Prisma.Decimal(0)),
      );

      let partyKey: string;
      if (o.billingParty === BillingParty.DEPARTMENT) {
        partyKey = 'Department';
        if (o.guestName?.trim()) officeGuestOrders += 1;
      } else if (o.customerId) {
        partyKey = 'Individual (staff)';
        namedStaffOrders += 1;
      } else {
        partyKey = 'Walk-in';
        walkInOrders += 1;
      }

      const party = partyMap.get(partyKey) ?? { orderCount: 0, total: new Prisma.Decimal(0) };
      party.orderCount += 1;
      party.total = party.total.add(o.total);
      partyMap.set(partyKey, party);

      const dept = o.customerDepartment?.trim() || 'Unassigned';
      const deptEntry = deptMap.get(dept) ?? { orderCount: 0, total: new Prisma.Decimal(0) };
      deptEntry.orderCount += 1;
      deptEntry.total = deptEntry.total.add(o.total);
      deptMap.set(dept, deptEntry);

      if (o.customerId && o.customer) {
        const name = [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ');
        const key = o.customerId;
        const staff = staffMap.get(key) ?? {
          customerId: o.customerId,
          name,
          department: o.customer.department,
          phoneExtension: o.customer.phoneExtension,
          orderCount: 0,
          total: new Prisma.Decimal(0),
        };
        staff.orderCount += 1;
        staff.total = staff.total.add(o.total);
        staffMap.set(key, staff);
      }
    }

    const guestDenom = officeGuestOrders + namedStaffOrders;
    const guestRatioPct =
      guestDenom > 0 ? ((officeGuestOrders / guestDenom) * 100).toFixed(1) : '0.0';

    const unpaidOrders = await this.prisma.order.findMany({
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
      select: { total: true, deferredAt: true },
    });

    const now = Date.now();
    const aging = {
      h0_24: { bucket: '0–24 hours', count: 0, total: new Prisma.Decimal(0) },
      d1_3: { bucket: '1–3 days', count: 0, total: new Prisma.Decimal(0) },
      d7plus: { bucket: '7+ days', count: 0, total: new Prisma.Decimal(0) },
    };

    for (const o of unpaidOrders) {
      const ref = o.deferredAt?.getTime() ?? now;
      const hours = (now - ref) / 3600000;
      const days = hours / 24;
      let bucket: keyof typeof aging = 'h0_24';
      if (days >= 7) bucket = 'd7plus';
      else if (days >= 1) bucket = 'd1_3';
      aging[bucket].count += 1;
      aging[bucket].total = aging[bucket].total.add(o.total);
    }

    const deferredInPeriod = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        deferredAt: { gte: from, lte: toEnd },
      },
      select: { paidAt: true, status: true, total: true },
    });

    let deferredCount = deferredInPeriod.length;
    let collectedCount = deferredInPeriod.filter((o) => o.paidAt != null).length;
    for (const o of deferredInPeriod) {
      if (o.status === 'VOIDED') writeOffTotal = writeOffTotal.add(o.total);
    }

    const collectionRatePct =
      deferredCount > 0 ? ((collectedCount / deferredCount) * 100).toFixed(1) : '100.0';

    const trendStart = new Date(from);
    trendStart.setUTCMonth(trendStart.getUTCMonth() - 5);
    const trendOrders = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        businessDate: { gte: trendStart, lte: this.parseDate(toDate) },
        status: { notIn: ['DRAFT', 'VOIDED'] },
        customerDepartment: { not: null },
      },
      select: { businessDate: true, customerDepartment: true, total: true },
    });

    const trendMap = new Map<string, { total: Prisma.Decimal; orderCount: number }>();
    for (const o of trendOrders) {
      const bd = o.businessDate ?? new Date();
      const month = bd.toISOString().slice(0, 7);
      const dept = o.customerDepartment!.trim();
      const key = `${month}|${dept}`;
      const entry = trendMap.get(key) ?? { total: new Prisma.Decimal(0), orderCount: 0 };
      entry.total = entry.total.add(o.total);
      entry.orderCount += 1;
      trendMap.set(key, entry);
    }

    return {
      branchId,
      fromDate,
      toDate,
      byBillingParty: [...partyMap.entries()].map(([party, v]) => ({
        party,
        orderCount: v.orderCount,
        total: decimalToString(v.total),
      })),
      guestVsStaff: {
        officeGuestOrders,
        namedStaffOrders,
        walkInOrders,
        guestRatioPct,
      },
      topDepartments: [...deptMap.entries()]
        .map(([department, v]) => ({
          department,
          orderCount: v.orderCount,
          total: decimalToString(v.total),
        }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
        .slice(0, 15),
      departmentTrend: [...trendMap.entries()]
        .map(([key, v]) => {
          const [month, department] = key.split('|');
          return {
            month,
            department,
            total: decimalToString(v.total),
            orderCount: v.orderCount,
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month)),
      topStaff: [...staffMap.values()]
        .map((s) => ({
          customerId: s.customerId,
          name: s.name,
          department: s.department,
          phoneExtension: s.phoneExtension,
          orderCount: s.orderCount,
          total: decimalToString(s.total),
        }))
        .sort((a, b) => parseFloat(b.total) - parseFloat(a.total))
        .slice(0, 20),
      payLaterAging: Object.values(aging).map((b) => ({
        bucket: b.bucket,
        count: b.count,
        total: decimalToString(b.total),
      })),
      collections: {
        deferredCount,
        collectedCount,
        collectionRatePct,
        writeOffTotal: decimalToString(writeOffTotal),
        refundTotal: decimalToString(refundTotal),
      },
    };
  }

  async getDepartmentStatement(
    branchId: string,
    organizationId: string,
    department: string,
    month: string,
  ) {
    const branch = await this.assertBranch(branchId, organizationId);
    const { from, to } = this.parseMonth(month);

    const orders = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        customerDepartment: department,
        billingParty: BillingParty.DEPARTMENT,
        businessDate: { gte: from, lte: to },
        status: { notIn: ['DRAFT', 'VOIDED'] },
      },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        customer: { select: { firstName: true, lastName: true } },
      },
      orderBy: [{ businessDate: 'asc' }, { orderNumber: 'asc' }],
    });

    let subtotal = new Prisma.Decimal(0);
    let discountTotal = new Prisma.Decimal(0);
    let taxTotal = new Prisma.Decimal(0);
    let total = new Prisma.Decimal(0);

    const lines = orders.map((o) => {
      subtotal = subtotal.add(o.subtotal);
      discountTotal = discountTotal.add(o.discountTotal);
      taxTotal = taxTotal.add(o.taxTotal);
      total = total.add(o.total);

      const staffName = o.customer
        ? [o.customer.firstName, o.customer.lastName].filter(Boolean).join(' ')
        : o.customerName;

      return {
        orderId: o.id,
        orderNumber: o.orderNumber,
        businessDate: (o.businessDate ?? o.createdAt).toISOString().slice(0, 10),
        billedTo: department,
        guestName: o.guestName,
        staffName: staffName ?? null,
        lineSummary: o.lines.map((l) => `${l.quantity}× ${l.itemName}`).join(', '),
        subtotal: decimalToString(o.subtotal),
        discountTotal: decimalToString(o.discountTotal),
        taxTotal: decimalToString(o.taxTotal),
        total: decimalToString(o.total),
        status: o.status,
        paidAt: o.paidAt?.toISOString() ?? null,
      };
    });

    const monthLabel = new Date(`${month}-01T00:00:00.000Z`).toLocaleDateString('en-GB', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    });

    return {
      branchId,
      branchName: branch.name,
      department,
      month,
      periodLabel: monthLabel,
      orderCount: orders.length,
      subtotal: decimalToString(subtotal),
      discountTotal: decimalToString(discountTotal),
      taxTotal: decimalToString(taxTotal),
      total: decimalToString(total),
      lines,
    };
  }

  buildDepartmentStatementCsv(statement: {
    branchName: string;
    department: string;
    periodLabel: string;
    total: string;
    lines: Array<{
      orderNumber: number;
      businessDate: string;
      guestName: string | null;
      staffName: string | null;
      lineSummary: string;
      subtotal: string;
      discountTotal: string;
      taxTotal: string;
      total: string;
      status: string;
      paidAt: string | null;
    }>;
  }) {
    const header = [
      'Order #',
      'Date',
      'Guest',
      'Staff',
      'Items',
      'Subtotal',
      'Discount',
      'Tax',
      'Total',
      'Status',
      'Paid at',
    ];
    const rows = statement.lines.map((l) => [
      l.orderNumber,
      l.businessDate,
      l.guestName ?? '',
      l.staffName ?? '',
      l.lineSummary,
      l.subtotal,
      l.discountTotal,
      l.taxTotal,
      l.total,
      l.status,
      l.paidAt ?? '',
    ]);
    const escape = (v: string | number) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return [
      `Department statement — ${statement.department}`,
      `Branch: ${statement.branchName}`,
      `Period: ${statement.periodLabel}`,
      `Total chargeback: ${statement.total} QAR`,
      '',
      header.join(','),
      ...rows.map((r) => r.map(escape).join(',')),
    ].join('\n');
  }

  async listBillingDepartments(branchId: string, organizationId: string) {
    await this.assertBranch(branchId, organizationId);
    const rows = await this.prisma.order.findMany({
      where: {
        branchId,
        organizationId,
        customerDepartment: { not: null },
        billingParty: BillingParty.DEPARTMENT,
      },
      select: { customerDepartment: true },
      distinct: ['customerDepartment'],
      orderBy: { customerDepartment: 'asc' },
    });
    return rows.map((r) => r.customerDepartment!).filter(Boolean);
  }

  private parseMonth(month: string) {
    const match = /^(\d{4})-(\d{2})$/.exec(month);
    if (!match) throw new NotFoundException('Invalid month — use YYYY-MM');
    const year = parseInt(match[1], 10);
    const mon = parseInt(match[2], 10);
    const from = new Date(Date.UTC(year, mon - 1, 1));
    const to = new Date(Date.UTC(year, mon, 0));
    return { from, to };
  }
}

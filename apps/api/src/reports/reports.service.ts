import { Injectable, NotFoundException } from '@nestjs/common';
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

  private async assertBranch(branchId: string, organizationId: string) {
    const branch = await this.prisma.branch.findFirst({
      where: { id: branchId, organizationId, deletedAt: null, isActive: true },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
  }
}

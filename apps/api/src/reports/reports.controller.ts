import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { BranchAccessGuard } from '../common/guards/branch-access.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard, BranchAccessGuard)
@Permissions('report.view', 'finance.view')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('daily-sales')
  dailySales(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('businessDate') businessDate: string,
  ) {
    return this.reportsService.getDailySales(branchId, user.organizationId, businessDate);
  }

  @Get('product-performance')
  productPerformance(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('businessDate') businessDate: string,
  ) {
    return this.reportsService.getProductPerformance(branchId, user.organizationId, businessDate);
  }

  @Get('ingredient-usage')
  ingredientUsage(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('businessDate') businessDate: string,
  ) {
    return this.reportsService.getIngredientUsage(branchId, user.organizationId, businessDate);
  }

  @Get('employee-activity')
  employeeActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('businessDate') businessDate: string,
  ) {
    return this.reportsService.getEmployeeActivity(branchId, user.organizationId, businessDate);
  }

  @Get('unpaid-orders')
  unpaidOrders(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
  ) {
    return this.reportsService.getUnpaidOrders(branchId, user.organizationId);
  }

  @Get('waste')
  wasteAnalytics(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('businessDate') businessDate: string,
  ) {
    return this.reportsService.getWasteAnalytics(branchId, user.organizationId, businessDate);
  }

  @Get('dashboard')
  dashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('businessDate') businessDate: string,
    @Query('trendDays') trendDays?: string,
  ) {
    return this.reportsService.getDashboardAnalytics(
      branchId,
      user.organizationId,
      businessDate,
      trendDays ? parseInt(trendDays, 10) : 7,
    );
  }

  @Get('organization-dashboard')
  organizationDashboard(
    @CurrentUser() user: AuthenticatedUser,
    @Query('businessDate') businessDate: string,
    @Query('trendDays') trendDays?: string,
  ) {
    return this.reportsService.getOrganizationDashboard(
      user.organizationId,
      businessDate,
      trendDays ? parseInt(trendDays, 10) : 7,
    );
  }

  @Get('ar-aging')
  arAging(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.reportsService.getArAging(branchId, user.organizationId);
  }

  @Get('loyalty-summary')
  loyaltySummary(@CurrentUser() user: AuthenticatedUser, @Query('branchId') branchId: string) {
    return this.reportsService.getLoyaltySummary(branchId, user.organizationId);
  }

  @Get('sales-range')
  salesRange(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getSalesRange(branchId, user.organizationId, from, to);
  }

  @Get('pnl')
  pnl(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getPnlAnalytics(branchId, user.organizationId, from, to);
  }

  @Get('corporate-billing')
  corporateBilling(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.reportsService.getCorporateBilling(branchId, user.organizationId, from, to);
  }

  @Get('billing-departments')
  billingDepartments(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
  ) {
    return this.reportsService.listBillingDepartments(branchId, user.organizationId);
  }

  @Get('department-statement')
  departmentStatement(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('department') department: string,
    @Query('month') month: string,
  ) {
    return this.reportsService.getDepartmentStatement(
      branchId,
      user.organizationId,
      department,
      month,
    );
  }

  @Get('department-statement/export')
  @Permissions('report.export', 'finance.view')
  async departmentStatementExport(
    @CurrentUser() user: AuthenticatedUser,
    @Query('branchId') branchId: string,
    @Query('department') department: string,
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const statement = await this.reportsService.getDepartmentStatement(
      branchId,
      user.organizationId,
      department,
      month,
    );
    const csv = this.reportsService.buildDepartmentStatementCsv(statement);
    const filename = `statement-${department.replace(/\s+/g, '-')}-${month}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}

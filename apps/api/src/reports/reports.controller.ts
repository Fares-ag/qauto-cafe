import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('reports')
@UseGuards(JwtAuthGuard)
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
}

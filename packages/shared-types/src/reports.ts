export interface DailySalesReport {
  branchId: string;
  businessDate: string;
  orderCount: number;
  grossSales: string;
  netSales: string;
  discountTotal: string;
  taxTotal: string;
  cogsTotal: string;
  cashTotal: string;
  cardTotal: string;
  voidCount: number;
  refundTotal: string;
  drinkSales: string;
  snackSales: string;
  refreshedAt: string;
}

export interface ProductSalesReportRow {
  menuItemId: string;
  menuItemName: string;
  businessDate: string;
  quantitySold: number;
  grossSales: string;
  cogsTotal: string;
}

export interface IngredientUsageReportRow {
  ingredientId: string;
  ingredientName: string;
  businessDate: string;
  quantityUsed: string;
  uomCode: string;
  valueUsed: string;
}

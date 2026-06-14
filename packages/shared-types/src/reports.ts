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
  corporateTotal?: string;
  otherTotal?: string;
  tipTotal?: string;
  voidCount: number;
  refundTotal: string;
  drinkSales: string;
  snackSales: string;
  refreshedAt: string;
}

export interface DashboardAnalytics {
  businessDate: string;
  kpis: DailySalesReport & {
    marginPct: string;
    avgTicket: string;
    foodCostPct: string;
  };
  hourly: Array<{ hour: number; label: string; orderCount: number; netSales: string }>;
  orderTypes: Array<{ orderType: string; orderCount: number; netSales: string }>;
  paymentMix: Array<{ method: string; amount: string }>;
  categoryMix: Array<{ category: string; amount: string }>;
  trend: Array<{ businessDate: string; netSales: string; orderCount: number; cogsTotal: string }>;
}

export interface ArAgingReport {
  branchId: string;
  outstandingTotal: string;
  orderCount: number;
  buckets: Array<{ label: string; count: number; total: string }>;
  byDepartment: Array<{ department: string; count: number; total: string }>;
}

export interface LoyaltySummaryReport {
  branchId: string;
  activeAccounts: number;
  totalPointsBalance: number;
  pointsIssued30d: number;
  pointsRedeemed30d: number;
  liabilityQar: string;
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

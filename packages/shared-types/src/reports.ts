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

export interface PnlAnalyticsReport {
  branchId: string;
  fromDate: string;
  toDate: string;
  summary: {
    grossSales: string;
    netSales: string;
    discountTotal: string;
    taxTotal: string;
    refundTotal: string;
    voidCount: number;
    cogsTotal: string;
    contributionMargin: string;
    marginPct: string;
    orderCount: number;
    avgTicket: string;
    avgItemsPerOrder: string;
  };
  paymentTenders: {
    cash: string;
    card: string;
    corporate: string;
    other: string;
    deferredOutstanding: string;
    deferredCreatedInPeriod: string;
    deferredCollectedInPeriod: string;
  };
  dailyTrend: Array<{
    businessDate: string;
    grossSales: string;
    netSales: string;
    cashTotal: string;
    cardTotal: string;
    orderCount: number;
  }>;
  marginByCategory: Array<{
    category: string;
    quantitySold: number;
    grossSales: string;
    cogsTotal: string;
    margin: string;
    marginPct: string;
  }>;
  marginBySku: Array<{
    menuItemId: string;
    menuItemName: string;
    category: string;
    quantitySold: number;
    grossSales: string;
    cogsTotal: string;
    margin: string;
    marginPct: string;
  }>;
}

export interface CorporateBillingReport {
  branchId: string;
  fromDate: string;
  toDate: string;
  byBillingParty: Array<{ party: string; orderCount: number; total: string }>;
  guestVsStaff: {
    officeGuestOrders: number;
    namedStaffOrders: number;
    walkInOrders: number;
    guestRatioPct: string;
  };
  topDepartments: Array<{ department: string; orderCount: number; total: string }>;
  departmentTrend: Array<{ month: string; department: string; total: string; orderCount: number }>;
  topStaff: Array<{
    customerId: string | null;
    name: string;
    department: string | null;
    phoneExtension: string | null;
    orderCount: number;
    total: string;
  }>;
  payLaterAging: Array<{ bucket: string; count: number; total: string }>;
  collections: {
    deferredCount: number;
    collectedCount: number;
    collectionRatePct: string;
    writeOffTotal: string;
    refundTotal: string;
  };
}

export interface DepartmentStatementLine {
  orderId: string;
  orderNumber: number;
  businessDate: string;
  billedTo: string;
  guestName: string | null;
  staffName: string | null;
  lineSummary: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  status: string;
  paidAt: string | null;
}

export interface DepartmentStatementReport {
  branchId: string;
  branchName: string;
  department: string;
  month: string;
  periodLabel: string;
  orderCount: number;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  lines: DepartmentStatementLine[];
}

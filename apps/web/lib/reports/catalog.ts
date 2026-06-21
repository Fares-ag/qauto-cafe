export type ReportCategory = 'Sales' | 'Finance' | 'Inventory' | 'Staff' | 'Corporate';

export type ReportParamKey = 'businessDate' | 'dateRange' | 'month' | 'department';

export type ReportDefinition = {
  id: string;
  category: ReportCategory;
  title: string;
  description: string;
  params: ReportParamKey[];
};

export const REPORT_CATALOG: ReportDefinition[] = [
  {
    id: 'daily-sales',
    category: 'Sales',
    title: 'Daily sales summary',
    description: 'Gross & net sales, payment mix, discounts, refunds, and order count for one business day.',
    params: ['businessDate'],
  },
  {
    id: 'sales-range',
    category: 'Sales',
    title: 'Sales trend (range)',
    description: 'Day-by-day sales, COGS, and refunds across a date range.',
    params: ['dateRange'],
  },
  {
    id: 'product-performance',
    category: 'Sales',
    title: 'Product performance',
    description: 'Units sold, revenue, and COGS by menu item.',
    params: ['businessDate'],
  },
  {
    id: 'pnl',
    category: 'Finance',
    title: 'P&L & margin analysis',
    description: 'Contribution margin by category and SKU, payment tenders, avg ticket.',
    params: ['dateRange'],
  },
  {
    id: 'corporate-billing',
    category: 'Corporate',
    title: 'Corporate billing & receivables',
    description: 'Billing party split, top departments & staff, pay-later aging, collection rate.',
    params: ['dateRange'],
  },
  {
    id: 'department-statement',
    category: 'Corporate',
    title: 'Department chargeback statement',
    description: 'Monthly itemized statement for internal department billing.',
    params: ['month', 'department'],
  },
  {
    id: 'ar-aging',
    category: 'Corporate',
    title: 'Accounts receivable aging',
    description: 'Outstanding deferred orders by age bucket and department.',
    params: [],
  },
  {
    id: 'unpaid-orders',
    category: 'Corporate',
    title: 'Unpaid orders register',
    description: 'All open pay-later orders awaiting collection.',
    params: [],
  },
  {
    id: 'ingredient-usage',
    category: 'Inventory',
    title: 'Ingredient usage',
    description: 'Consumption quantities and value by ingredient.',
    params: ['businessDate'],
  },
  {
    id: 'waste',
    category: 'Inventory',
    title: 'Waste & shrinkage',
    description: 'Waste events and value lost by ingredient.',
    params: ['businessDate'],
  },
  {
    id: 'staff-activity',
    category: 'Staff',
    title: 'Staff activity',
    description: 'Orders handled, sales, voids, and discounts by cashier.',
    params: ['businessDate'],
  },
];

export const REPORT_CATEGORIES: ReportCategory[] = [
  'Sales',
  'Finance',
  'Corporate',
  'Inventory',
  'Staff',
];

export function getReportDefinition(id: string): ReportDefinition | undefined {
  return REPORT_CATALOG.find((r) => r.id === id);
}

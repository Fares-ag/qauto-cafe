import { getApiClient, formatQar } from '@/lib/api';
import type { ReportDocumentData } from './types';

export type ReportParams = {
  businessDate: string;
  fromDate: string;
  toDate: string;
  month: string;
  department: string;
  branchId: string;
};

function nowLabel() {
  return new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

export async function loadReportDocument(
  reportId: string,
  params: ReportParams,
): Promise<ReportDocumentData> {
  const client = getApiClient();
  const { branchId, businessDate, fromDate, toDate, month, department } = params;
  const generatedAt = nowLabel();

  switch (reportId) {
    case 'daily-sales': {
      const s = await client.getDailySalesReport(branchId, businessDate);
      const avg =
        s.orderCount > 0 ? formatQar(String(parseFloat(s.netSales) / s.orderCount)) : '0.00';
      return {
        meta: {
          reportId,
          title: 'Daily Sales Summary',
          subtitle: 'QAuto Café — Operations Report',
          periodLabel: businessDate,
          generatedAt,
        },
        kpis: [
          { label: 'Gross sales', value: formatQar(s.grossSales) },
          { label: 'Net sales', value: formatQar(s.netSales), hint: `${s.orderCount} orders` },
          { label: 'COGS', value: formatQar(s.cogsTotal) },
          { label: 'Avg ticket', value: avg },
        ],
        sections: [
          {
            title: 'Payment mix',
            columns: ['Method', 'Amount (QAR)'],
            rows: [
              ['Cash', s.cashTotal],
              ['Card', s.cardTotal],
              ['Corporate', s.corporateTotal ?? '0'],
              ['Other', s.otherTotal ?? '0'],
            ],
          },
          {
            title: 'Adjustments & category',
            columns: ['Metric', 'Amount (QAR)'],
            rows: [
              ['Discounts', s.discountTotal],
              ['Tax', s.taxTotal],
              ['Refunds', s.refundTotal],
              ['Tips', s.tipTotal ?? '0'],
              ['Drink sales', s.drinkSales],
              ['Snack sales', s.snackSales],
              ['Voids (count)', s.voidCount],
            ],
          },
        ],
      };
    }

    case 'sales-range': {
      const rows = await client.getSalesRangeReport(branchId, fromDate, toDate);
      const totals = rows.reduce(
        (acc, r) => ({
          net: acc.net + parseFloat(r.netSales),
          gross: acc.gross + parseFloat(r.grossSales),
          cogs: acc.cogs + parseFloat(r.cogsTotal),
          orders: acc.orders + r.orderCount,
        }),
        { net: 0, gross: 0, cogs: 0, orders: 0 },
      );
      return {
        meta: {
          reportId,
          title: 'Sales Trend Report',
          subtitle: 'QAuto Café — Period Analysis',
          periodLabel: `${fromDate} → ${toDate}`,
          generatedAt,
        },
        kpis: [
          { label: 'Total net sales', value: formatQar(String(totals.net)) },
          { label: 'Total orders', value: String(totals.orders) },
          { label: 'Total COGS', value: formatQar(String(totals.cogs)) },
          {
            label: 'Margin',
            value: totals.net > 0 ? `${(((totals.net - totals.cogs) / totals.net) * 100).toFixed(1)}%` : '—',
          },
        ],
        sections: [
          {
            columns: ['Date', 'Orders', 'Gross', 'Net', 'COGS', 'Discounts', 'Refunds'],
            rows: rows.map((r) => [
              r.businessDate,
              r.orderCount,
              r.grossSales,
              r.netSales,
              r.cogsTotal,
              r.discountTotal,
              r.refundTotal,
            ]),
          },
        ],
      };
    }

    case 'product-performance': {
      const products = await client.getProductPerformance(branchId, businessDate);
      return {
        meta: {
          reportId,
          title: 'Product Performance',
          subtitle: 'QAuto Café — Menu Analysis',
          periodLabel: businessDate,
          generatedAt,
        },
        sections: [
          {
            columns: ['Product', 'Qty sold', 'Gross sales', 'COGS', 'Margin %'],
            rows: products.map((p) => {
              const g = parseFloat(p.grossSales);
              const c = parseFloat(p.cogsTotal);
              const m = g > 0 ? (((g - c) / g) * 100).toFixed(1) : '0.0';
              return [p.menuItemName, p.quantitySold, p.grossSales, p.cogsTotal, `${m}%`];
            }),
          },
        ],
      };
    }

    case 'pnl': {
      const pnl = await client.getPnlAnalytics(branchId, fromDate, toDate);
      return {
        meta: {
          reportId,
          title: 'P&L & Margin Analysis',
          subtitle: 'QAuto Café — Financial Report',
          periodLabel: `${fromDate} → ${toDate}`,
          generatedAt,
        },
        kpis: [
          { label: 'Net sales', value: formatQar(pnl.summary.netSales) },
          { label: 'Contribution margin', value: `${pnl.summary.marginPct}%` },
          { label: 'Avg ticket', value: formatQar(pnl.summary.avgTicket) },
          { label: 'Items / order', value: pnl.summary.avgItemsPerOrder },
        ],
        sections: [
          {
            title: 'P&L summary',
            columns: ['Line item', 'Amount (QAR)'],
            rows: [
              ['Gross sales', pnl.summary.grossSales],
              ['Discounts', `−${pnl.summary.discountTotal}`],
              ['Refunds', `−${pnl.summary.refundTotal}`],
              ['COGS', `−${pnl.summary.cogsTotal}`],
              ['Contribution margin', pnl.summary.contributionMargin],
            ],
          },
          {
            title: 'Payment tenders',
            columns: ['Tender', 'Amount (QAR)'],
            rows: [
              ['Cash', pnl.paymentTenders.cash],
              ['Card', pnl.paymentTenders.card],
              ['Corporate', pnl.paymentTenders.corporate],
              ['Deferred outstanding', pnl.paymentTenders.deferredOutstanding],
            ],
          },
          {
            title: 'Margin by category',
            columns: ['Category', 'Qty', 'Sales', 'COGS', 'Margin', 'Margin %'],
            rows: pnl.marginByCategory.map((r) => [
              r.category,
              r.quantitySold,
              r.grossSales,
              r.cogsTotal,
              r.margin,
              `${r.marginPct}%`,
            ]),
          },
          {
            title: 'Margin by product',
            columns: ['Product', 'Category', 'Qty', 'Sales', 'Margin', 'Margin %'],
            rows: pnl.marginBySku.map((r) => [
              r.menuItemName,
              r.category,
              r.quantitySold,
              r.grossSales,
              r.margin,
              `${r.marginPct}%`,
            ]),
          },
        ],
      };
    }

    case 'corporate-billing': {
      const c = await client.getCorporateBillingReport(branchId, fromDate, toDate);
      return {
        meta: {
          reportId,
          title: 'Corporate Billing & Receivables',
          subtitle: 'QAuto Café — Internal Accounts',
          periodLabel: `${fromDate} → ${toDate}`,
          generatedAt,
        },
        kpis: [
          { label: 'Collection rate', value: `${c.collections.collectionRatePct}%` },
          { label: 'Office guests', value: String(c.guestVsStaff.officeGuestOrders) },
          { label: 'Staff orders', value: String(c.guestVsStaff.namedStaffOrders) },
          { label: 'Guest ratio', value: `${c.guestVsStaff.guestRatioPct}%` },
        ],
        sections: [
          {
            title: 'By billing party',
            columns: ['Party', 'Orders', 'Total (QAR)'],
            rows: c.byBillingParty.map((r) => [r.party, r.orderCount, r.total]),
          },
          {
            title: 'Pay-later aging (unpaid)',
            columns: ['Bucket', 'Orders', 'Total (QAR)'],
            rows: c.payLaterAging.map((r) => [r.bucket, r.count, r.total]),
          },
          {
            title: 'Top departments',
            columns: ['Department', 'Orders', 'Total (QAR)'],
            rows: c.topDepartments.map((r) => [r.department, r.orderCount, r.total]),
          },
          {
            title: 'Top staff',
            columns: ['Name', 'Department', 'Ext.', 'Orders', 'Total (QAR)'],
            rows: c.topStaff.map((r) => [
              r.name,
              r.department ?? '—',
              r.phoneExtension ?? '—',
              r.orderCount,
              r.total,
            ]),
          },
        ],
      };
    }

    case 'department-statement': {
      const s = await client.getDepartmentStatement(branchId, department, month);
      return {
        meta: {
          reportId,
          title: 'Department Chargeback Statement',
          subtitle: s.branchName,
          periodLabel: s.periodLabel,
          branchLabel: s.branchName,
          generatedAt,
        },
        kpis: [
          { label: 'Department', value: s.department },
          { label: 'Orders', value: String(s.orderCount) },
          { label: 'Total chargeback', value: formatQar(s.total) },
        ],
        sections: [
          {
            columns: ['Order #', 'Date', 'Guest / staff', 'Items', 'Total', 'Status'],
            rows: s.lines.map((l) => [
              l.orderNumber,
              l.businessDate,
              l.guestName ?? l.staffName ?? '—',
              l.lineSummary,
              l.total,
              l.status,
            ]),
            footerRow: ['', '', '', 'Total', s.total, ''],
          },
        ],
      };
    }

    case 'ar-aging': {
      const ar = await client.getArAgingReport(branchId);
      return {
        meta: {
          reportId,
          title: 'Accounts Receivable Aging',
          subtitle: 'QAuto Café — Outstanding Balances',
          periodLabel: 'As of today',
          generatedAt,
        },
        kpis: [
          { label: 'Outstanding', value: formatQar(ar.outstandingTotal) },
          { label: 'Open orders', value: String(ar.orderCount) },
        ],
        sections: [
          {
            title: 'By age bucket',
            columns: ['Bucket', 'Orders', 'Total (QAR)'],
            rows: ar.buckets.map((b) => [b.label, b.count, b.total]),
          },
          {
            title: 'By department',
            columns: ['Department', 'Orders', 'Total (QAR)'],
            rows: ar.byDepartment.map((d) => [d.department, d.count, d.total]),
          },
        ],
      };
    }

    case 'unpaid-orders': {
      const u = await client.getUnpaidOrdersReport(branchId);
      return {
        meta: {
          reportId,
          title: 'Unpaid Orders Register',
          subtitle: 'QAuto Café — Collections',
          periodLabel: 'As of today',
          generatedAt,
        },
        kpis: [
          { label: 'Outstanding', value: formatQar(u.outstandingTotal) },
          { label: 'Orders', value: String(u.orderCount) },
        ],
        sections: [
          {
            columns: ['Order #', 'Customer', 'Department', 'Total', 'Deferred', 'Due date'],
            rows: u.orders.map((o) => [
              o.orderNumber,
              o.customerName ?? '—',
              o.customerDepartment ?? '—',
              o.total,
              o.deferredAt ? o.deferredAt.slice(0, 10) : '—',
              o.paymentDueDate ?? '—',
            ]),
          },
        ],
      };
    }

    case 'ingredient-usage': {
      const items = await client.getIngredientUsage(branchId, businessDate);
      return {
        meta: {
          reportId,
          title: 'Ingredient Usage',
          subtitle: 'QAuto Café — Inventory',
          periodLabel: businessDate,
          generatedAt,
        },
        sections: [
          {
            columns: ['Ingredient', 'Quantity', 'UOM', 'Value (QAR)'],
            rows: items.map((i) => [i.ingredientName, i.quantityUsed, i.uomCode, i.valueUsed]),
          },
        ],
      };
    }

    case 'waste': {
      const w = await client.getWasteAnalytics(branchId, businessDate);
      return {
        meta: {
          reportId,
          title: 'Waste & Shrinkage',
          subtitle: 'QAuto Café — Inventory Loss',
          periodLabel: businessDate,
          generatedAt,
        },
        kpis: [
          { label: 'Total value lost', value: formatQar(w.totalValue) },
          { label: 'Events', value: String(w.totalRecords) },
        ],
        sections: [
          {
            columns: ['Ingredient', 'Qty wasted', 'Value (QAR)', 'Events'],
            rows: w.byIngredient.map((i) => [
              i.ingredientName,
              i.quantityWasted,
              i.valueWasted,
              i.eventCount,
            ]),
          },
        ],
      };
    }

    case 'staff-activity': {
      const staff = (await client.getEmployeeActivity(branchId, businessDate)) as Array<{
        userName: string;
        ordersHandled: number;
        grossSales: string;
        discountTotal: string;
        refundTotal: string;
        voidCount: number;
      }>;
      return {
        meta: {
          reportId,
          title: 'Staff Activity',
          subtitle: 'QAuto Café — Cashier Performance',
          periodLabel: businessDate,
          generatedAt,
        },
        sections: [
          {
            columns: ['Staff', 'Orders', 'Gross sales', 'Discounts', 'Refunds', 'Voids'],
            rows: staff.map((e) => [
              e.userName,
              e.ordersHandled,
              e.grossSales,
              e.discountTotal,
              e.refundTotal,
              e.voidCount,
            ]),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown report: ${reportId}`);
  }
}

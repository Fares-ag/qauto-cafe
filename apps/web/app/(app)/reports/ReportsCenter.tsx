'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Button,
  Card,
  EmptyState,
  Input,
  useToast,
} from '@qauto/ui';
import { Download, FileText, Printer } from 'lucide-react';
import { ReportDocumentPreview } from '@/components/reports/ReportDocumentPreview';
import {
  REPORT_CATALOG,
  REPORT_CATEGORIES,
  getReportDefinition,
  type ReportDefinition,
} from '@/lib/reports/catalog';
import { loadReportDocument, type ReportParams } from '@/lib/reports/load-report';
import { documentToCsv, printReportDocument } from '@/lib/reports/print-document';
import { downloadCsv } from '@/lib/reports/csv';
import { slugFilename } from '@/lib/reports/types';
import { getApiClient, getBusinessDate } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';

function monthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function ReportsCenter() {
  const branchId = useAuthStore((s) => s.branchId);
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const initialReport = searchParams.get('report') ?? 'daily-sales';
  const [selectedId, setSelectedId] = useState(
    getReportDefinition(initialReport) ? initialReport : 'daily-sales',
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [businessDate, setBusinessDate] = useState(getBusinessDate());
  const [fromDate, setFromDate] = useState(monthStart());
  const [toDate, setToDate] = useState(getBusinessDate());
  const [month, setMonth] = useState(currentMonth());
  const [department, setDepartment] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [document, setDocument] = useState<Awaited<ReturnType<typeof loadReportDocument>> | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const definition = getReportDefinition(selectedId);

  useEffect(() => {
    if (!branchId) return;
    getApiClient()
      .getBillingDepartments(branchId)
      .then((list) => {
        setDepartments(list);
        if (list.length > 0 && !department) setDepartment(list[0]);
      })
      .catch(() => undefined);
  }, [branchId, department]);

  const filteredCatalog = useMemo(() => {
    if (categoryFilter === 'All') return REPORT_CATALOG;
    return REPORT_CATALOG.filter((r) => r.category === categoryFilter);
  }, [categoryFilter]);

  const buildParams = useCallback((): ReportParams | null => {
    if (!branchId) return null;
    return { branchId, businessDate, fromDate, toDate, month, department };
  }, [branchId, businessDate, fromDate, toDate, month, department]);

  const generate = useCallback(async () => {
    const params = buildParams();
    if (!params || !definition) return;
    setLoading(true);
    setGenerated(false);
    try {
      const doc = await loadReportDocument(selectedId, params);
      setDocument(doc);
      setGenerated(true);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to generate report', 'error');
      setDocument(null);
    } finally {
      setLoading(false);
    }
  }, [buildParams, definition, selectedId, toast]);

  function exportCsvFile() {
    if (!document) return;
    const csv = documentToCsv(document);
    downloadCsv(slugFilename(document.meta.reportId, document.meta.periodLabel), csv);
    toast('CSV downloaded', 'success');
  }

  function printPdf() {
    if (!document) return;
    printReportDocument(document);
  }

  function selectReport(report: ReportDefinition) {
    setSelectedId(report.id);
    setDocument(null);
    setGenerated(false);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Report center</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Generate professionally formatted reports — preview on screen, export CSV, or save as PDF
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {['All', ...REPORT_CATEGORIES].map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategoryFilter(cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              categoryFilter === cat
                ? 'bg-brand text-brand-foreground'
                : 'border border-border text-ink-secondary hover:bg-surface-sunken'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(240px,280px)_1fr]">
        <aside className="space-y-2">
          {filteredCatalog.map((report) => (
            <button
              key={report.id}
              type="button"
              onClick={() => selectReport(report)}
              className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                selectedId === report.id
                  ? 'border-brand bg-brand-muted/30 shadow-soft'
                  : 'border-border bg-surface-raised hover:border-brand/30'
              }`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand">
                {report.category}
              </p>
              <p className="mt-0.5 text-sm font-semibold text-ink">{report.title}</p>
              <p className="mt-1 line-clamp-2 text-xs text-ink-muted">{report.description}</p>
            </button>
          ))}
        </aside>

        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-ink">{definition?.title}</h2>
                <p className="text-sm text-ink-muted">{definition?.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={generate} disabled={loading || !branchId}>
                  {loading ? 'Generating…' : 'Generate report'}
                </Button>
                {generated && document ? (
                  <>
                    <Button variant="secondary" onClick={exportCsvFile}>
                      <Download size={16} className="mr-1.5 inline" />
                      CSV
                    </Button>
                    <Button variant="secondary" onClick={printPdf}>
                      <Printer size={16} className="mr-1.5 inline" />
                      PDF / Print
                    </Button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3 border-t border-border pt-4">
              {definition?.params.includes('businessDate') ? (
                <Input
                  label="Business date"
                  type="date"
                  value={businessDate}
                  onChange={(e) => setBusinessDate(e.target.value)}
                />
              ) : null}
              {definition?.params.includes('dateRange') ? (
                <>
                  <Input label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                  <Input label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </>
              ) : null}
              {definition?.params.includes('month') ? (
                <Input label="Month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              ) : null}
              {definition?.params.includes('department') ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-ink">Department</span>
                  <select
                    className="w-full min-w-[200px] rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    {departments.length === 0 ? (
                      <option value="">No departments yet</option>
                    ) : (
                      departments.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))
                    )}
                  </select>
                </label>
              ) : null}
            </div>
          </Card>

          {loading ? (
            <Card padding="lg">
              <div className="flex items-center gap-3 text-sm text-ink-muted">
                <FileText size={20} className="animate-pulse text-brand" />
                Building report…
              </div>
            </Card>
          ) : null}

          {!loading && generated && document ? (
            <ReportDocumentPreview data={document} />
          ) : null}

          {!loading && !generated ? (
            <EmptyState
              title="Select a report and generate"
              description="Choose from 11 report types covering sales, finance, corporate billing, inventory, and staff. Export to CSV or print a polished PDF."
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

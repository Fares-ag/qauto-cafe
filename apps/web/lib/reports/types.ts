export type ReportKpi = {
  label: string;
  value: string;
  hint?: string;
};

export type ReportSection = {
  title?: string;
  description?: string;
  columns: string[];
  rows: (string | number)[][];
  footerRow?: (string | number)[];
};

export type ReportDocumentData = {
  meta: {
    title: string;
    subtitle: string;
    periodLabel: string;
    branchLabel?: string;
    generatedAt: string;
    reportId: string;
  };
  kpis?: ReportKpi[];
  sections: ReportSection[];
};

export function slugFilename(reportId: string, period: string) {
  const safe = period.replace(/[^\d-]/g, '').slice(0, 10) || 'report';
  return `qauto-${reportId}-${safe}`;
}

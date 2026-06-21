'use client';

import type { ReportDocumentData } from '@/lib/reports/types';

type Props = {
  data: ReportDocumentData;
};

export function ReportDocumentPreview({ data }: Props) {
  return (
    <div className="report-document mx-auto max-w-4xl rounded-xl border border-border bg-white text-ink shadow-card print:max-w-none print:rounded-none print:border-0 print:shadow-none">
      <div className="border-b-4 border-brand px-8 pb-6 pt-8">
        <p className="text-2xl font-bold tracking-tight text-brand">QAuto Café</p>
        <p className="mt-1 text-sm text-ink-muted">{data.meta.subtitle}</p>
        <h2 className="mt-4 text-xl font-semibold text-ink">{data.meta.title}</h2>
        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-muted">
          <div>
            <dt className="inline">Period: </dt>
            <dd className="inline font-medium text-ink-secondary">{data.meta.periodLabel}</dd>
          </div>
          {data.meta.branchLabel ? (
            <div>
              <dt className="inline">Branch: </dt>
              <dd className="inline font-medium text-ink-secondary">{data.meta.branchLabel}</dd>
            </div>
          ) : null}
          <div>
            <dt className="inline">Generated: </dt>
            <dd className="inline">{data.meta.generatedAt}</dd>
          </div>
        </dl>
      </div>

      {data.kpis && data.kpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 border-b border-border bg-surface-sunken/40 px-8 py-5 sm:grid-cols-4">
          {data.kpis.map((k) => (
            <div key={k.label} className="rounded-lg border border-border/80 bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {k.label}
              </p>
              <p className="mt-1 text-lg font-bold text-ink">{k.value}</p>
              {k.hint ? <p className="mt-0.5 text-xs text-ink-muted">{k.hint}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="space-y-8 px-8 py-6">
        {data.sections.map((sec, idx) => (
          <section key={idx}>
            {sec.title ? (
              <h3 className="mb-1 text-sm font-semibold text-ink">{sec.title}</h3>
            ) : null}
            {sec.description ? (
              <p className="mb-3 text-xs text-ink-muted">{sec.description}</p>
            ) : null}
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-sunken/60">
                    {sec.columns.map((col) => (
                      <th
                        key={col}
                        className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-muted"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sec.rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={sec.columns.length}
                        className="px-4 py-8 text-center text-ink-muted"
                      >
                        No data for this period
                      </td>
                    </tr>
                  ) : (
                    sec.rows.map((row, ri) => (
                      <tr
                        key={ri}
                        className={ri % 2 === 1 ? 'bg-surface-sunken/30' : undefined}
                      >
                        {row.map((cell, ci) => (
                          <td key={ci} className="border-b border-border/50 px-4 py-2.5 text-ink-secondary">
                            {String(cell)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
                {sec.footerRow ? (
                  <tfoot>
                    <tr className="bg-brand-muted/30 font-semibold">
                      {sec.footerRow.map((cell, ci) => (
                        <td key={ci} className="px-4 py-2.5">
                          {String(cell)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          </section>
        ))}
      </div>

      <div className="border-t border-border px-8 py-4 text-center text-[10px] text-ink-muted">
        Confidential — internal use only · QAuto Café reporting
      </div>
    </div>
  );
}

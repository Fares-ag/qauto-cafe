import type { ReportDocumentData } from './types';

const PRINT_STYLES = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1a1a1a;
    font-size: 11pt;
    line-height: 1.45;
    margin: 0;
    padding: 0;
  }
  .doc { max-width: 210mm; margin: 0 auto; }
  .header {
    border-bottom: 3px solid #8B4513;
    padding-bottom: 16px;
    margin-bottom: 24px;
  }
  .brand { font-size: 22pt; font-weight: 700; color: #8B4513; letter-spacing: -0.02em; }
  .subtitle { font-size: 10pt; color: #666; margin-top: 4px; }
  .title { font-size: 16pt; font-weight: 600; margin: 16px 0 4px; }
  .meta { font-size: 9pt; color: #888; display: flex; gap: 24px; flex-wrap: wrap; margin-top: 8px; }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 12px;
    margin-bottom: 28px;
  }
  .kpi {
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 12px 14px;
    background: #fafafa;
  }
  .kpi-label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #888; }
  .kpi-value { font-size: 14pt; font-weight: 700; margin-top: 4px; color: #1a1a1a; }
  .kpi-hint { font-size: 8pt; color: #aaa; margin-top: 2px; }
  .section { margin-bottom: 24px; page-break-inside: avoid; }
  .section-title { font-size: 11pt; font-weight: 600; margin-bottom: 8px; color: #333; }
  .section-desc { font-size: 9pt; color: #888; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; font-size: 9.5pt; }
  th {
    text-align: left;
    font-weight: 600;
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #666;
    border-bottom: 2px solid #ddd;
    padding: 8px 10px;
  }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  tfoot td { font-weight: 700; border-top: 2px solid #333; background: #f5f5f5 !important; }
  .footer {
    margin-top: 32px;
    padding-top: 12px;
    border-top: 1px solid #ddd;
    font-size: 8pt;
    color: #999;
    text-align: center;
  }
`;

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function reportDocumentToHtml(data: ReportDocumentData): string {
  const kpiHtml = data.kpis?.length
    ? `<div class="kpis">${data.kpis
        .map(
          (k) => `
        <div class="kpi">
          <div class="kpi-label">${escapeHtml(k.label)}</div>
          <div class="kpi-value">${escapeHtml(k.value)}</div>
          ${k.hint ? `<div class="kpi-hint">${escapeHtml(k.hint)}</div>` : ''}
        </div>`,
        )
        .join('')}</div>`
    : '';

  const sectionsHtml = data.sections
    .map((sec) => {
      const body = sec.rows
        .map(
          (row) =>
            `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr>`,
        )
        .join('');
      const foot = sec.footerRow
        ? `<tfoot><tr>${sec.footerRow.map((cell) => `<td>${escapeHtml(String(cell))}</td>`).join('')}</tr></tfoot>`
        : '';
      return `
      <div class="section">
        ${sec.title ? `<div class="section-title">${escapeHtml(sec.title)}</div>` : ''}
        ${sec.description ? `<div class="section-desc">${escapeHtml(sec.description)}</div>` : ''}
        <table>
          <thead><tr>${sec.columns.map((c) => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
          <tbody>${body}</tbody>
          ${foot}
        </table>
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/>
<title>${escapeHtml(data.meta.title)} — QAuto Café</title>
<style>${PRINT_STYLES}</style>
</head><body>
<div class="doc">
  <div class="header">
    <div class="brand">QAuto Café</div>
    <div class="subtitle">${escapeHtml(data.meta.subtitle)}</div>
    <div class="title">${escapeHtml(data.meta.title)}</div>
    <div class="meta">
      <span>Period: ${escapeHtml(data.meta.periodLabel)}</span>
      ${data.meta.branchLabel ? `<span>Branch: ${escapeHtml(data.meta.branchLabel)}</span>` : ''}
      <span>Generated: ${escapeHtml(data.meta.generatedAt)}</span>
    </div>
  </div>
  ${kpiHtml}
  ${sectionsHtml}
  <div class="footer">Confidential — internal use only · QAuto Café reporting</div>
</div>
</body></html>`;
}

export function printReportDocument(data: ReportDocumentData) {
  const html = reportDocumentToHtml(data);
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

export function documentToCsv(data: ReportDocumentData): string {
  const preamble = [
    `QAuto Café — ${data.meta.title}`,
    `Period: ${data.meta.periodLabel}`,
    `Generated: ${data.meta.generatedAt}`,
  ];
  const parts: string[] = [`\uFEFF${preamble.join('\n')}\n`];

  if (data.kpis?.length) {
    parts.push('Summary');
    parts.push(['Metric', 'Value'].join(','));
    for (const k of data.kpis) {
      parts.push(`"${k.label.replace(/"/g, '""')}","${k.value.replace(/"/g, '""')}"`);
    }
    parts.push('');
  }

  for (const sec of data.sections) {
    if (sec.title) parts.push(sec.title);
    parts.push(sec.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(','));
    for (const row of sec.rows) {
      parts.push(
        row
          .map((cell) => {
            const s = String(cell);
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      );
    }
    if (sec.footerRow) {
      parts.push(
        sec.footerRow
          .map((cell) => {
            const s = String(cell);
            return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      );
    }
    parts.push('');
  }

  return parts.join('\n');
}

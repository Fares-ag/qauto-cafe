function escapeCell(value: string | number): string {
  const s = String(value);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildCsv(
  header: string[],
  rows: (string | number)[][],
  preamble?: string[],
): string {
  const lines: string[] = [];
  if (preamble?.length) {
    lines.push(...preamble, '');
  }
  lines.push(header.map(escapeCell).join(','));
  for (const row of rows) {
    lines.push(row.map(escapeCell).join(','));
  }
  return `\uFEFF${lines.join('\n')}`;
}

export function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

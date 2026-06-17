import * as XLSX from 'xlsx';

export type ParsedDirectoryRow = {
  extension: string | null;
  name: string;
  department: string;
  position: string;
  email: string | null;
  phone: string | null;
  extensionDisplay: string | null;
  sheet: string;
};

export type DirectoryParseStats = {
  totalRows: number;
  withExtension: number;
  withoutExtension: number;
  skippedHeaders: number;
  skippedEmpty: number;
};

export type DirectoryParseResult = {
  entries: ParsedDirectoryRow[];
  stats: DirectoryParseStats;
};

export function parseExtension(raw: unknown): string | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().replace(/\u00a0/g, ' ');
  if (!s || /^n\/?a$/i.test(s) || /showroom/i.test(s)) return null;

  const paren = s.match(/\((\d+)\)/);
  if (paren) return paren[1];

  const digits = s.replace(/\D/g, '');
  if (digits.length >= 3 && digits.length <= 5) return digits;
  if (digits.length > 5) return digits.slice(-4);
  return null;
}

export function normalizeDepartment(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .replace(/\s*DEPARTMENT\s*$/i, '')
    .replace(/\s*DEPARMENT\s*$/i, '')
    .trim();
}

function isDepartmentHeader(name: string, position: string, extension: string | null): boolean {
  if (/department/i.test(name) || /deparment/i.test(name)) return true;
  if (!position && !extension && name === name.toUpperCase() && name.length > 6) return true;
  return false;
}

export function rosterKey(row: Pick<ParsedDirectoryRow, 'extension' | 'department' | 'name'>): string {
  if (row.extension) return `ext:${row.extension}`;
  return `roster:${row.department.toLowerCase()}|${row.name.toLowerCase()}`;
}

export function parseDirectoryWorkbook(wb: XLSX.WorkBook): DirectoryParseResult {
  const entries: ParsedDirectoryRow[] = [];
  const seen = new Map<string, ParsedDirectoryRow>();
  const stats: DirectoryParseStats = {
    totalRows: 0,
    withExtension: 0,
    withoutExtension: 0,
    skippedHeaders: 0,
    skippedEmpty: 0,
  };

  for (const sheetName of wb.SheetNames) {
    if (sheetName === 'Q Auto Directory') continue;

    const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: '',
    }) as unknown[][];

    let department = sheetName;

    for (const row of rows) {
      const blocks = row.length > 8 ? 3 : 1;
      for (let b = 0; b < blocks; b++) {
        const off = b * 6;
        const name = String(row[off] ?? '').trim();
        const position = String(row[off + 1] ?? '').trim();
        const mobile = String(row[off + 2] ?? '').trim();
        const emailRaw = String(row[off + 3] ?? '').trim();
        const extRaw = row[off + 4];

        if (!name || name === 'Name') {
          if (name === 'Name') continue;
          stats.skippedEmpty++;
          continue;
        }

        stats.totalRows++;
        const extension = parseExtension(extRaw);
        if (isDepartmentHeader(name, position, extension)) {
          department = normalizeDepartment(name);
          stats.skippedHeaders++;
          continue;
        }

        const email =
          emailRaw && !/^n\/?a$/i.test(emailRaw) && emailRaw.includes('@')
            ? emailRaw.toLowerCase()
            : null;
        const phone =
          mobile && !/^n\/?a$/i.test(mobile) ? mobile.replace(/\s+/g, ' ') : null;

        const entry: ParsedDirectoryRow = {
          extension,
          name: name.replace(/\s+/g, ' ').trim(),
          department: normalizeDepartment(department) || sheetName,
          position,
          email,
          phone,
          extensionDisplay: extension ? String(extRaw ?? extension).trim() : null,
          sheet: sheetName,
        };

        const key = rosterKey(entry);
        const existing = seen.get(key);
        if (!existing) {
          seen.set(key, entry);
          entries.push(entry);
          if (extension) stats.withExtension++;
          else stats.withoutExtension++;
          continue;
        }

        if (!existing.email && entry.email) {
          seen.set(key, entry);
          const idx = entries.findIndex((e) => rosterKey(e) === key);
          if (idx >= 0) entries[idx] = entry;
        }
      }
    }
  }

  entries.sort((a, b) => {
    if (a.extension && b.extension) {
      return a.extension.localeCompare(b.extension, undefined, { numeric: true });
    }
    if (a.extension) return -1;
    if (b.extension) return 1;
    return a.name.localeCompare(b.name);
  });

  return { entries, stats };
}

export function readDirectoryFromFile(filePath: string): DirectoryParseResult {
  const wb = XLSX.readFile(filePath);
  return parseDirectoryWorkbook(wb);
}

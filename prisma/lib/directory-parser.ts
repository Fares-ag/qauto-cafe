import * as XLSX from 'xlsx';

export type ParsedDirectoryRow = {
  extension: string;
  name: string;
  department: string;
  position: string;
  email: string | null;
  phone: string | null;
  extensionDisplay: string;
  sheet: string;
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

export function parseDirectoryWorkbook(wb: XLSX.WorkBook): ParsedDirectoryRow[] {
  const entries: ParsedDirectoryRow[] = [];
  const seen = new Map<string, ParsedDirectoryRow>();

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

        if (!name || name === 'Name') continue;

        const extension = parseExtension(extRaw);
        if (isDepartmentHeader(name, position, extension)) {
          department = normalizeDepartment(name);
          continue;
        }
        if (!extension) continue;

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
          extensionDisplay: String(extRaw ?? extension).trim(),
          sheet: sheetName,
        };

        const existing = seen.get(extension);
        if (!existing) {
          seen.set(extension, entry);
          entries.push(entry);
          continue;
        }

        if (!existing.email && entry.email) {
          seen.set(extension, entry);
          const idx = entries.findIndex((e) => e.extension === extension);
          if (idx >= 0) entries[idx] = entry;
        }
      }
    }
  }

  return entries.sort((a, b) =>
    a.extension.localeCompare(b.extension, undefined, { numeric: true }),
  );
}

export function readDirectoryFromFile(filePath: string): ParsedDirectoryRow[] {
  const wb = XLSX.readFile(filePath);
  return parseDirectoryWorkbook(wb);
}

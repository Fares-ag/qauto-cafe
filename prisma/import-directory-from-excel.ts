#!/usr/bin/env tsx
/**
 * Import Q-Auto office directory from Excel into customers (register staff lookup).
 *
 * Usage:
 *   npx tsx prisma/import-directory-from-excel.ts --dry-run
 *   npx tsx prisma/import-directory-from-excel.ts --import
 *   npx tsx prisma/import-directory-from-excel.ts --file "path/to/directory.xlsx"
 *   npx tsx prisma/import-directory-from-excel.ts --generate-ts   # refresh prisma/data/office-directory.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import {
  readDirectoryFromFile,
  rosterKey,
  type ParsedDirectoryRow,
} from './lib/directory-parser';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: withConnectionLimit(process.env.DIRECT_URL ?? process.env.DATABASE_URL),
    },
  },
});

function withConnectionLimit(url?: string): string | undefined {
  if (!url) return url;
  if (url.includes('connection_limit=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=1`;
}

const DRY_RUN = process.argv.includes('--dry-run');
const GENERATE_TS = process.argv.includes('--generate-ts');
const SHOULD_IMPORT = process.argv.includes('--import') || (!GENERATE_TS && !DRY_RUN);
const fileArgIdx = process.argv.indexOf('--file');
const DEFAULT_FILE = path.join(__dirname, 'data', 'Q-Auto-Directory-2026.xlsx');
const FILE =
  fileArgIdx >= 0 ? process.argv[fileArgIdx + 1] : DEFAULT_FILE;

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function buildNotes(row: ParsedDirectoryRow): string | null {
  const parts = [row.position];
  if (row.extension && row.extensionDisplay && row.extensionDisplay !== row.extension) {
    parts.push(`Line: ${row.extensionDisplay}`);
  }
  const notes = parts.filter(Boolean).join(' · ');
  return notes || null;
}

function toTsModule(rows: ParsedDirectoryRow[]): string {
  const withExt = rows.filter((r) => r.extension);
  const lines = withExt.map((r) => {
    const dept = r.department.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const name = r.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const pos = r.position.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    return `  { extension: '${r.extension}', name: '${name}', department: '${dept}', position: '${pos}'${r.email ? `, email: '${r.email}'` : ''}${r.phone ? `, phone: '${r.phone}'` : ''} },`;
  });

  return `/**
 * Q-Auto office directory — generated from Q-Auto Directory 2026.xlsx
 * Regenerate: npx tsx prisma/import-directory-from-excel.ts --generate-ts
 */
export type OfficeDirectoryEntry = {
  extension: string;
  name: string;
  department: string;
  position?: string;
  email?: string;
  phone?: string;
};

export const OFFICE_DIRECTORY: OfficeDirectoryEntry[] = [
${lines.join('\n')}
];

export const OFFICE_DEPARTMENTS = [
  ...new Set(OFFICE_DIRECTORY.map((e) => e.department)),
].sort();
`;
}

async function resolveOrg() {
  const org = await prisma.organization.findFirst({
    where: { OR: [{ slug: 'qauto' }, { name: { contains: 'QAuto', mode: 'insensitive' } }] },
  });
  if (!org) throw new Error('Organization not found — run seed first');
  return org;
}

async function findExisting(
  organizationId: string,
  row: ParsedDirectoryRow,
) {
  if (row.extension) {
    return prisma.customer.findFirst({
      where: { organizationId, phoneExtension: row.extension, deletedAt: null },
    });
  }

  const { firstName, lastName } = splitName(row.name);
  return prisma.customer.findFirst({
    where: {
      organizationId,
      deletedAt: null,
      isOfficeDirectory: true,
      phoneExtension: null,
      firstName,
      lastName,
      department: row.department,
    },
  });
}

async function upsertDirectory(organizationId: string, rows: ParsedDirectoryRow[]) {
  let created = 0;
  let updated = 0;
  let deactivated = 0;
  const withExtension = rows.filter((r) => r.extension).length;
  const withoutExtension = rows.filter((r) => !r.extension).length;

  for (const row of rows) {
    const { firstName, lastName } = splitName(row.name);
    const notes = buildNotes(row);
    const existing = await findExisting(organizationId, row);

    const data = {
      firstName,
      lastName,
      department: row.department,
      email: row.email,
      phone: row.phone,
      notes,
      phoneExtension: row.extension,
      isOfficeDirectory: true,
      isActive: true,
    };

    if (DRY_RUN) {
      if (existing) updated++;
      else created++;
      continue;
    }

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data,
      });
      updated++;
    } else {
      await prisma.customer.create({
        data: {
          organizationId,
          ...data,
        },
      });
      created++;
    }
  }

  const activeKeys = new Set(rows.map((r) => rosterKey(r)));
  const roster = await prisma.customer.findMany({
    where: {
      organizationId,
      deletedAt: null,
      isOfficeDirectory: true,
      isActive: true,
    },
    select: {
      id: true,
      phoneExtension: true,
      department: true,
      firstName: true,
      lastName: true,
    },
  });

  for (const c of roster) {
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
    const key = c.phoneExtension
      ? `ext:${c.phoneExtension}`
      : `roster:${(c.department ?? '').toLowerCase()}|${name.toLowerCase()}`;
    if (activeKeys.has(key)) continue;

    if (!DRY_RUN) {
      await prisma.customer.update({
        where: { id: c.id },
        data: { isActive: false },
      });
    }
    deactivated++;
  }

  return {
    created,
    updated,
    deactivated,
    withExtension,
    withoutExtension,
    total: rows.length,
  };
}

async function main() {
  if (!fs.existsSync(FILE)) {
    throw new Error(`File not found: ${FILE}`);
  }

  const { entries: rows, stats } = readDirectoryFromFile(FILE);
  console.log(`Parsed from ${path.basename(FILE)}:`);
  console.log(`  total rows scanned: ${stats.totalRows}`);
  console.log(`  with extension:     ${stats.withExtension}`);
  console.log(`  without extension:  ${stats.withoutExtension}`);
  console.log(`  skipped (headers):  ${stats.skippedHeaders}`);
  console.log(`  skipped (empty):    ${stats.skippedEmpty}`);
  console.log(`  unique entries:     ${rows.length}`);

  if (GENERATE_TS) {
    const out = path.join(__dirname, 'data', 'office-directory.ts');
    fs.writeFileSync(out, toTsModule(rows), 'utf8');
    console.log(`Wrote ${out}`);
  }

  if (!SHOULD_IMPORT) {
    return;
  }

  const org = await resolveOrg();
  const result = await upsertDirectory(org.id, rows);
  console.log(DRY_RUN ? '[dry-run] import result:' : 'Import result:', result);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

#!/usr/bin/env tsx
/**
 * Import Q-Auto office directory from Excel into customers (register extension lookup).
 *
 * Usage:
 *   npx tsx prisma/import-directory-from-excel.ts --dry-run
 *   npx tsx prisma/import-directory-from-excel.ts
 *   npx tsx prisma/import-directory-from-excel.ts --file "path/to/directory.xlsx"
 *   npx tsx prisma/import-directory-from-excel.ts --generate-ts   # refresh prisma/data/office-directory.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { readDirectoryFromFile, type ParsedDirectoryRow } from './lib/directory-parser';

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
const fileArgIdx = process.argv.indexOf('--file');
const DEFAULT_FILE = path.join(__dirname, 'data', 'Q-Auto-Directory-2026.xlsx');
const FILE =
  fileArgIdx >= 0 ? process.argv[fileArgIdx + 1] : DEFAULT_FILE;

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function toTsModule(rows: ParsedDirectoryRow[]): string {
  const lines = rows.map((r) => {
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

async function upsertDirectory(organizationId: string, rows: ParsedDirectoryRow[]) {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const { firstName, lastName } = splitName(row.name);
    const notes = [row.position, row.extensionDisplay !== row.extension ? `Line: ${row.extensionDisplay}` : '']
      .filter(Boolean)
      .join(' · ');

    const existing = await prisma.customer.findFirst({
      where: { organizationId, phoneExtension: row.extension, deletedAt: null },
    });

    if (DRY_RUN) {
      if (existing) updated++;
      else created++;
      continue;
    }

    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: {
          firstName,
          lastName,
          department: row.department,
          email: row.email,
          phone: row.phone,
          notes,
          isActive: true,
        },
      });
      updated++;
    } else {
      await prisma.customer.create({
        data: {
          organizationId,
          firstName,
          lastName,
          department: row.department,
          phoneExtension: row.extension,
          email: row.email,
          phone: row.phone,
          notes,
        },
      });
      created++;
    }
  }

  // Deactivate directory entries removed from the source file
  const extensions = new Set(rows.map((r) => r.extension));
  const stale = await prisma.customer.findMany({
    where: {
      organizationId,
      deletedAt: null,
      phoneExtension: { not: null, notIn: [...extensions] },
      isActive: true,
    },
    select: { id: true },
  });

  for (const c of stale) {
    if (!DRY_RUN) {
      await prisma.customer.update({
        where: { id: c.id },
        data: { isActive: false },
      });
    }
    skipped++;
  }

  return { created, updated, skipped, total: rows.length };
}

async function main() {
  if (!fs.existsSync(FILE)) {
    throw new Error(`File not found: ${FILE}`);
  }

  const rows = readDirectoryFromFile(FILE);
  console.log(`Parsed ${rows.length} directory entries from ${path.basename(FILE)}`);

  if (GENERATE_TS) {
    const out = path.join(__dirname, 'data', 'office-directory.ts');
    fs.writeFileSync(out, toTsModule(rows), 'utf8');
    console.log(`Wrote ${out}`);
  }

  if (GENERATE_TS && !process.argv.includes('--import')) {
    return;
  }

  const org = await resolveOrg();
  const stats = await upsertDirectory(org.id, rows);
  console.log(DRY_RUN ? '[dry-run] ' : '', stats);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

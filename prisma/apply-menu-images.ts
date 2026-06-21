#!/usr/bin/env tsx
/**
 * Apply stock image URLs to all menu items in the database.
 *
 * Usage:
 *   npx tsx prisma/apply-menu-images.ts
 *   npx tsx prisma/apply-menu-images.ts --dry-run
 */
import { PrismaClient } from '@prisma/client';
import { MENU_ROWS, type MenuCategoryName } from './data/cafe-menu';
import { resolveMenuImageUrl } from './data/menu-images';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: withConnectionLimit(process.env.DIRECT_URL ?? process.env.DATABASE_URL),
    },
  },
});

const DRY_RUN = process.argv.includes('--dry-run');

function withConnectionLimit(url?: string): string | undefined {
  if (!url) return url;
  if (url.includes('connection_limit=')) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}connection_limit=1`;
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: { OR: [{ slug: 'qauto' }, { name: { contains: 'QAuto', mode: 'insensitive' } }] },
  });
  if (!org) throw new Error('Organization not found');

  let updated = 0;
  let missing = 0;

  for (const row of MENU_ROWS) {
    const imageUrl = resolveMenuImageUrl(row.code, row.category as MenuCategoryName);
    const existing = await prisma.menuItem.findFirst({
      where: { organizationId: org.id, code: row.code, deletedAt: null },
      select: { id: true, name: true, imageUrl: true },
    });

    if (!existing) {
      console.log(`  skip (not in DB): ${row.code}`);
      missing++;
      continue;
    }

    if (existing.imageUrl === imageUrl) {
      console.log(`  ok: ${row.name}`);
      continue;
    }

    if (!DRY_RUN) {
      await prisma.menuItem.update({
        where: { id: existing.id },
        data: { imageUrl },
      });
    }

    console.log(`${DRY_RUN ? '[dry-run] ' : ''}update: ${row.name}`);
    updated++;
  }

  console.log(DRY_RUN ? '[dry-run] ' : '', { updated, missing, total: MENU_ROWS.length });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

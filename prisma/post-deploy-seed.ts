/**
 * Lightweight production post-migrate seed: office directory + staff role permissions.
 * Run: npx tsx prisma/post-deploy-seed.ts
 * Uses DIRECT_URL when set (recommended for Supabase), else DATABASE_URL.
 */
import { PrismaClient } from '@prisma/client';
import { OFFICE_DIRECTORY } from './data/office-directory';

const CASHIER_PERMISSIONS = [
  'pos.access',
  'bar.access',
  'bar.manage_queue',
  'order.create',
  'order.update',
  'order.discount',
  'order.comp',
  'payment.process',
  'shift.open',
  'shift.close',
  'shift.cash_event',
  'menu.view',
  'menu.manage',
  'menu.86',
  'modifier.manage',
  'recipe.view',
  'ingredient.view',
  'stock.view',
  'customer.view',
];

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
    },
  },
});

async function seedOfficeDirectory(organizationId: string) {
  for (const entry of OFFICE_DIRECTORY) {
    const [firstName, ...rest] = entry.name.split(/\s+/);
    const lastName = rest.join(' ') || null;
    const existing = await prisma.customer.findFirst({
      where: { organizationId, phoneExtension: entry.extension, deletedAt: null },
    });
    if (existing) {
      await prisma.customer.update({
        where: { id: existing.id },
        data: { firstName, lastName, department: entry.department, isActive: true },
      });
      continue;
    }
    await prisma.customer.create({
      data: {
        organizationId,
        firstName,
        lastName,
        department: entry.department,
        phoneExtension: entry.extension,
        notes: 'Office extension directory',
      },
    });
  }
}

async function assignStaffPermissions(organizationId: string) {
  const staffRole = await prisma.role.findFirst({
    where: { organizationId, slug: 'staff', deletedAt: null },
  });
  if (!staffRole) {
    console.warn('No staff role found — skip permission update');
    return;
  }
  for (const code of CASHIER_PERMISSIONS) {
    const permission = await prisma.permission.findUnique({ where: { code } });
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: staffRole.id, permissionId: permission.id } },
      update: {},
      create: { roleId: staffRole.id, permissionId: permission.id },
    });
  }
}

async function main() {
  const org = await prisma.organization.findFirst({ where: { slug: 'qauto' } });
  if (!org) {
    throw new Error('Organization qauto not found — run full seed first');
  }
  await seedOfficeDirectory(org.id);
  await assignStaffPermissions(org.id);
  console.log('Post-deploy seed OK:', {
    officeEntries: OFFICE_DIRECTORY.length,
    staffPermissions: CASHIER_PERMISSIONS.length,
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/** Stock photos for seeded menu items (Unsplash, crop 400×300). */
const MENU_IMAGES = {
  LATTE: 'https://images.unsplash.com/photo-1561882468-090d8622a088?w=400&h=300&fit=crop',
  AMERICANO: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&h=300&fit=crop',
  ICED_TEA: 'https://images.unsplash.com/photo-1556679343-2192677f86f3?w=400&h=300&fit=crop',
  CROISSANT: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&h=300&fit=crop',
} as const;

/** Permission catalog — roles receive scoped subsets in production. */
const PERMISSIONS = [
  { code: '*', name: 'All Permissions (wildcard)', module: 'system' },

  // Organization & branches
  { code: 'org.view', name: 'View Organization', module: 'organization' },
  { code: 'org.manage', name: 'Manage Organization Settings', module: 'organization' },
  { code: 'branch.view', name: 'View Branches', module: 'organization' },
  { code: 'branch.manage', name: 'Manage Branches', module: 'organization' },
  { code: 'terminal.manage', name: 'Manage Terminals', module: 'organization' },

  // Auth & users
  { code: 'user.view', name: 'View Users', module: 'auth' },
  { code: 'user.manage', name: 'Manage Users', module: 'auth' },
  { code: 'role.manage', name: 'Manage Roles', module: 'auth' },

  // POS & orders
  { code: 'pos.access', name: 'Access POS Terminal', module: 'pos' },
  { code: 'order.create', name: 'Create Orders', module: 'orders' },
  { code: 'order.update', name: 'Update Orders', module: 'orders' },
  { code: 'order.void', name: 'Void Orders', module: 'orders' },
  { code: 'order.refund', name: 'Refund Orders', module: 'orders' },
  { code: 'order.discount', name: 'Apply Discounts', module: 'orders' },
  { code: 'order.comp', name: 'Comp Orders', module: 'orders' },

  // Bar display
  { code: 'bar.access', name: 'Access Bar Display', module: 'bar' },
  { code: 'bar.manage_queue', name: 'Manage Bar Queue', module: 'bar' },

  // Payments & shifts
  { code: 'payment.process', name: 'Process Payments', module: 'payments' },
  { code: 'shift.open', name: 'Open Shift', module: 'shifts' },
  { code: 'shift.close', name: 'Close Shift', module: 'shifts' },
  { code: 'shift.cash_event', name: 'Record Cash Events', module: 'shifts' },

  // Menu
  { code: 'menu.view', name: 'View Menu', module: 'menu' },
  { code: 'menu.manage', name: 'Manage Menu', module: 'menu' },
  { code: 'menu.86', name: '86 / Un-86 Items', module: 'menu' },
  { code: 'modifier.manage', name: 'Manage Modifiers', module: 'menu' },

  // Recipes
  { code: 'recipe.view', name: 'View Recipes', module: 'recipes' },
  { code: 'recipe.manage', name: 'Manage Recipes', module: 'recipes' },
  { code: 'recipe.approve', name: 'Approve Recipes', module: 'recipes' },
  { code: 'recipe.simulate', name: 'Simulate Recipe BOM', module: 'recipes' },

  // Inventory & FIFO
  { code: 'ingredient.view', name: 'View Ingredients', module: 'inventory' },
  { code: 'ingredient.manage', name: 'Manage Ingredients', module: 'inventory' },
  { code: 'stock.view', name: 'View Stock Levels', module: 'inventory' },
  { code: 'stock.receive', name: 'Receive Stock', module: 'inventory' },
  { code: 'stock.adjust', name: 'Adjust Stock', module: 'inventory' },
  { code: 'stock.waste', name: 'Record Waste', module: 'inventory' },
  { code: 'inventory.manage', name: 'Full Inventory Management', module: 'inventory' },

  // Procurement
  { code: 'supplier.manage', name: 'Manage Suppliers', module: 'procurement' },
  { code: 'po.manage', name: 'Manage Purchase Orders', module: 'procurement' },

  // Customers & loyalty (v2)
  { code: 'customer.view', name: 'View Customers', module: 'customers' },
  { code: 'customer.manage', name: 'Manage Customers', module: 'customers' },
  { code: 'loyalty.manage', name: 'Manage Loyalty', module: 'customers' },

  // Reporting & finance
  { code: 'report.view', name: 'View Reports', module: 'reporting' },
  { code: 'report.export', name: 'Export Reports', module: 'reporting' },
  { code: 'finance.view', name: 'View Financial Data', module: 'finance' },
  { code: 'finance.close_period', name: 'Close Financial Period', module: 'finance' },

  // Audit & admin
  { code: 'audit.view', name: 'View Audit Logs', module: 'audit' },
  { code: 'admin.access', name: 'Access Admin Portal', module: 'admin' },
];

const OWNER_PERMISSIONS = ['*'];

const MANAGER_PERMISSIONS = [
  'admin.access',
  'branch.view',
  'branch.manage',
  'terminal.manage',
  'user.view',
  'user.manage',
  'report.view',
  'report.export',
  'finance.view',
  'audit.view',
  'menu.view',
  'menu.manage',
  'menu.86',
  'modifier.manage',
  'recipe.view',
  'recipe.manage',
  'recipe.approve',
  'recipe.simulate',
  'ingredient.view',
  'ingredient.manage',
  'stock.view',
  'stock.receive',
  'stock.adjust',
  'stock.waste',
  'inventory.manage',
  'supplier.manage',
  'po.manage',
  'customer.view',
  'customer.manage',
  'loyalty.manage',
  'order.void',
  'order.refund',
  'payment.process',
];

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
  'stock.view',
  'customer.view',
];

async function assignRolePermissions(roleId: string, codes: string[]) {
  for (const code of codes) {
    const permission = await prisma.permission.findUnique({ where: { code } });
    if (!permission) continue;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId, permissionId: permission.id } },
      update: {},
      create: { roleId, permissionId: permission.id },
    });
  }
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: 'qauto' },
    update: {},
    create: {
      name: 'QAuto Café',
      slug: 'qauto',
      timezone: 'Asia/Qatar',
      currency: 'QAR',
    },
  });

  const ownerRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'owner' } },
    update: { description: 'Full organization access' },
    create: {
      organizationId: org.id,
      name: 'Owner',
      slug: 'owner',
      description: 'Full organization access',
      isSystem: true,
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { organizationId_slug: { organizationId: org.id, slug: 'manager' } },
    update: { description: 'Back-office and operations management' },
    create: {
      organizationId: org.id,
      name: 'Manager',
      slug: 'manager',
      description: 'Back-office and operations management',
      isSystem: true,
    },
  });

  const staffRole = await prisma.role.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: 'staff',
      },
    },
    update: {
      description: 'Front-of-house POS and kitchen access',
    },
    create: {
      organizationId: org.id,
      name: 'Staff',
      slug: 'staff',
      description: 'Front-of-house POS and kitchen access',
      isSystem: true,
    },
  });

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { name: permission.name, module: permission.module },
      create: permission,
    });
  }

  await assignRolePermissions(ownerRole.id, OWNER_PERMISSIONS);
  await assignRolePermissions(managerRole.id, MANAGER_PERMISSIONS);
  await assignRolePermissions(staffRole.id, CASHIER_PERMISSIONS);

  const branch = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: org.id,
        code: 'MAIN',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Main Café',
      code: 'MAIN',
      address: 'HQ Building',
    },
  });

  const uoms = [
    { code: 'g', name: 'Gram', symbol: 'g' },
    { code: 'kg', name: 'Kilogram', symbol: 'kg' },
    { code: 'ml', name: 'Millilitre', symbol: 'ml' },
    { code: 'L', name: 'Litre', symbol: 'L' },
    { code: 'each', name: 'Each', symbol: 'ea' },
    { code: 'pump', name: 'Pump', symbol: 'pump' },
    { code: 'bottle', name: 'Bottle', symbol: 'btl' },
    { code: 'case', name: 'Case', symbol: 'case' },
  ];

  for (const uom of uoms) {
    await prisma.uom.upsert({
      where: { code: uom.code },
      update: {},
      create: uom,
    });
  }

  const g = await prisma.uom.findUniqueOrThrow({ where: { code: 'g' } });
  const kg = await prisma.uom.findUniqueOrThrow({ where: { code: 'kg' } });
  const ml = await prisma.uom.findUniqueOrThrow({ where: { code: 'ml' } });
  const L = await prisma.uom.findUniqueOrThrow({ where: { code: 'L' } });

  const globalConversions: Array<{ fromId: string; toId: string; factor: string }> = [
    { fromId: kg.id, toId: g.id, factor: '1000' },
    { fromId: L.id, toId: ml.id, factor: '1000' },
  ];

  for (const conv of globalConversions) {
    const existing = await prisma.uomConversion.findFirst({
      where: { fromUomId: conv.fromId, toUomId: conv.toId, ingredientId: null },
    });
    if (existing) {
      await prisma.uomConversion.update({
        where: { id: existing.id },
        data: { factor: conv.factor },
      });
    } else {
      await prisma.uomConversion.create({
        data: {
          fromUomId: conv.fromId,
          toUomId: conv.toId,
          factor: conv.factor,
        },
      });
    }
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  const pinHash = await bcrypt.hash('1234', 10);
  const cashierPasswordHash = await bcrypt.hash('cashier123', 10);
  const cashierPinHash = await bcrypt.hash('5678', 10);

  const devUser = await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: 'admin@qauto.com',
      },
    },
    update: {
      passwordHash,
      pinHash,
    },
    create: {
      organizationId: org.id,
      roleId: ownerRole.id,
      email: 'admin@qauto.com',
      passwordHash,
      pinHash,
      firstName: 'Admin',
      lastName: 'User',
      employeeNumber: 'EMP001',
      branches: {
        create: [{ branchId: branch.id, isDefault: true }],
      },
    },
  });

  await prisma.user.upsert({
    where: {
      organizationId_email: {
        organizationId: org.id,
        email: 'cashier@qauto.com',
      },
    },
    update: {
      passwordHash: cashierPasswordHash,
      pinHash: cashierPinHash,
      roleId: staffRole.id,
    },
    create: {
      organizationId: org.id,
      roleId: staffRole.id,
      email: 'cashier@qauto.com',
      passwordHash: cashierPasswordHash,
      pinHash: cashierPinHash,
      firstName: 'Cashier',
      lastName: 'User',
      employeeNumber: 'EMP002',
      branches: {
        create: [{ branchId: branch.id, isDefault: true }],
      },
    },
  });

  console.log('Seed complete:', {
    org: org.slug,
    branchId: branch.id,
    branch: branch.code,
    role: ownerRole.slug,
    permissions: PERMISSIONS.length,
    devUser: devUser.email,
    devPin: '1234',
  });

  await seedMenu(prisma, org.id, branch.id);
  await seedInventory(prisma, org.id, branch.id);
  await seedCrm(prisma, org.id, branch.id);
  await seedTerminals(prisma, branch.id);
}

async function seedTerminals(prisma: PrismaClient, branchId: string) {
  const existing = await prisma.terminal.findFirst({
    where: { branchId, type: 'POS', deletedAt: null },
  });
  if (!existing) {
    await prisma.terminal.create({
      data: { branchId, name: 'Main POS', type: 'POS', deviceToken: 'seed-pos-terminal' },
    });
  }
  const kitchen = await prisma.terminal.findFirst({
    where: { branchId, type: 'BAR_DISPLAY', deletedAt: null },
  });
  if (!kitchen) {
    await prisma.terminal.create({
      data: {
        branchId,
        name: 'Main Kitchen Display',
        type: 'BAR_DISPLAY',
        deviceToken: 'seed-kitchen-terminal',
      },
    });
  }
}

async function seedCrm(prisma: PrismaClient, organizationId: string, branchId: string) {
  const branch2 = await prisma.branch.upsert({
    where: { organizationId_code: { organizationId, code: 'NORTH' } },
    update: {},
    create: {
      organizationId,
      name: 'North Campus',
      code: 'NORTH',
      address: 'Building B',
    },
  });

  const customer = await prisma.customer.upsert({
    where: { id: 'seed-customer-1' },
    update: {},
    create: {
      id: 'seed-customer-1',
      organizationId,
      firstName: 'Sarah',
      lastName: 'Al-Thani',
      email: 'sarah@qauto.com',
      department: 'Engineering',
      employeeId: 'EMP100',
    },
  });

  await prisma.loyaltyAccount.upsert({
    where: { customerId: customer.id },
    update: {},
    create: { customerId: customer.id, pointsBalance: 250, lifetimePoints: 250 },
  });

  await prisma.reward.upsert({
    where: { id: 'seed-reward-1' },
    update: {},
    create: {
      id: 'seed-reward-1',
      organizationId,
      name: 'Free drink',
      pointsCost: 100,
    },
  });

  await prisma.giftCard.upsert({
    where: { code: 'GC-SEED001' },
    update: {},
    create: {
      code: 'GC-SEED001',
      organizationId,
      balance: 25,
      initialValue: 25,
      customerId: customer.id,
      status: 'ACTIVE',
    },
  });

  await prisma.ingredient.updateMany({
    where: { organizationId, code: { in: ['ESPRESSO_BEANS', 'WHOLE_MILK', 'CROISSANT_SKU'] } },
    data: { reorderPoint: 1000 },
  });

  console.log('CRM seeded:', { branch2: branch2.code, customer: customer.id });
}

async function upsertIngredient(
  prisma: PrismaClient,
  organizationId: string,
  data: {
    code: string;
    name: string;
    uomCode: string;
    isPackaging?: boolean;
    isSnackSku?: boolean;
  },
) {
  const uom = await prisma.uom.findUniqueOrThrow({ where: { code: data.uomCode } });
  return prisma.ingredient.upsert({
    where: { organizationId_code: { organizationId, code: data.code } },
    update: { name: data.name },
    create: {
      organizationId,
      code: data.code,
      name: data.name,
      baseUomId: uom.id,
      isPackaging: data.isPackaging ?? false,
      isSnackSku: data.isSnackSku ?? false,
    },
  });
}

async function seedInventory(prisma: PrismaClient, organizationId: string, branchId: string) {
  const beans = await upsertIngredient(prisma, organizationId, { code: 'ESPRESSO_BEANS', name: 'Espresso Beans', uomCode: 'g' });
  const wholeMilk = await upsertIngredient(prisma, organizationId, { code: 'WHOLE_MILK', name: 'Whole Milk', uomCode: 'ml' });
  const oatMilk = await upsertIngredient(prisma, organizationId, { code: 'OAT_MILK', name: 'Oat Milk', uomCode: 'ml' });
  const almondMilk = await upsertIngredient(prisma, organizationId, { code: 'ALMOND_MILK', name: 'Almond Milk', uomCode: 'ml' });
  const vanilla = await upsertIngredient(prisma, organizationId, { code: 'VANILLA_SYRUP', name: 'Vanilla Syrup', uomCode: 'pump' });
  const cup8 = await upsertIngredient(prisma, organizationId, { code: 'CUP_8OZ', name: 'Cup 8oz', uomCode: 'each', isPackaging: true });
  const cup12 = await upsertIngredient(prisma, organizationId, { code: 'CUP_12OZ', name: 'Cup 12oz', uomCode: 'each', isPackaging: true });
  const cup16 = await upsertIngredient(prisma, organizationId, { code: 'CUP_16OZ', name: 'Cup 16oz Cold', uomCode: 'each', isPackaging: true });
  const lid = await upsertIngredient(prisma, organizationId, { code: 'LID', name: 'Lid', uomCode: 'each', isPackaging: true });
  const sleeve = await upsertIngredient(prisma, organizationId, { code: 'SLEEVE', name: 'Sleeve', uomCode: 'each', isPackaging: true });
  const straw = await upsertIngredient(prisma, organizationId, { code: 'STRAW', name: 'Straw', uomCode: 'each', isPackaging: true });
  const croissantSku = await upsertIngredient(prisma, organizationId, { code: 'CROISSANT_SKU', name: 'Croissant (packaged)', uomCode: 'each', isSnackSku: true });

  const g = await prisma.uom.findUniqueOrThrow({ where: { code: 'g' } });
  const ml = await prisma.uom.findUniqueOrThrow({ where: { code: 'ml' } });
  const each = await prisma.uom.findUniqueOrThrow({ where: { code: 'each' } });
  const pump = await prisma.uom.findUniqueOrThrow({ where: { code: 'pump' } });

  const latte = await prisma.menuItem.findFirstOrThrow({ where: { organizationId, code: 'LATTE' } });
  const americano = await prisma.menuItem.findFirstOrThrow({ where: { organizationId, code: 'AMERICANO' } });
  const icedTea = await prisma.menuItem.findFirstOrThrow({ where: { organizationId, code: 'ICED_TEA' } });
  const croissant = await prisma.menuItem.findFirstOrThrow({ where: { organizationId, code: 'CROISSANT' } });

  await prisma.menuItem.update({
    where: { id: croissant.id },
    data: { snackIngredientId: croissantSku.id },
  });

  const latteSizes = await prisma.menuItemSize.findMany({ where: { menuItemId: latte.id } });
  const drinkRecipes: Array<{ itemId: string; sizeCode: string; lines: Array<{ ingredientId: string; qty: number; uomId: string }> }> = [
    {
      itemId: latte.id,
      sizeCode: 'S',
      lines: [
        { ingredientId: beans.id, qty: 14, uomId: g.id },
        { ingredientId: wholeMilk.id, qty: 180, uomId: ml.id },
        { ingredientId: cup8.id, qty: 1, uomId: each.id },
        { ingredientId: lid.id, qty: 1, uomId: each.id },
      ],
    },
    {
      itemId: latte.id,
      sizeCode: 'M',
      lines: [
        { ingredientId: beans.id, qty: 18, uomId: g.id },
        { ingredientId: wholeMilk.id, qty: 240, uomId: ml.id },
        { ingredientId: cup12.id, qty: 1, uomId: each.id },
        { ingredientId: lid.id, qty: 1, uomId: each.id },
        { ingredientId: sleeve.id, qty: 1, uomId: each.id },
      ],
    },
    {
      itemId: latte.id,
      sizeCode: 'L',
      lines: [
        { ingredientId: beans.id, qty: 22, uomId: g.id },
        { ingredientId: wholeMilk.id, qty: 300, uomId: ml.id },
        { ingredientId: cup16.id, qty: 1, uomId: each.id },
        { ingredientId: lid.id, qty: 1, uomId: each.id },
        { ingredientId: sleeve.id, qty: 1, uomId: each.id },
      ],
    },
  ];

  for (const americanoSize of ['S', 'M', 'L']) {
    const size = await prisma.menuItemSize.findFirstOrThrow({ where: { menuItemId: americano.id, code: americanoSize } });
    const beansQty = americanoSize === 'S' ? 14 : americanoSize === 'M' ? 18 : 22;
    const cup = americanoSize === 'S' ? cup8 : americanoSize === 'M' ? cup12 : cup16;
    const lines = [
      { ingredientId: beans.id, qty: beansQty, uomId: g.id },
      { ingredientId: cup.id, qty: 1, uomId: each.id },
      { ingredientId: lid.id, qty: 1, uomId: each.id },
    ];
    if (americanoSize !== 'S') {
      lines.push({ ingredientId: sleeve.id, qty: 1, uomId: each.id });
    }
    await createApprovedRecipe(prisma, americano.id, size.id, lines);
  }

  for (const config of drinkRecipes) {
    const size = latteSizes.find((s) => s.code === config.sizeCode);
    if (!size) continue;
    await createApprovedRecipe(prisma, config.itemId, size.id, config.lines);
  }

  const icedSizes = await prisma.menuItemSize.findMany({ where: { menuItemId: icedTea.id } });
  for (const size of icedSizes) {
    await createApprovedRecipe(prisma, icedTea.id, size.id, [
      { ingredientId: cup16.id, qty: 1, uomId: each.id },
      { ingredientId: lid.id, qty: 1, uomId: each.id },
      { ingredientId: straw.id, qty: 1, uomId: each.id },
    ]);
  }

  const oatMod = await prisma.modifier.findFirstOrThrow({ where: { code: 'oat', modifierGroup: { organizationId } } });
  const almondMod = await prisma.modifier.findFirstOrThrow({ where: { code: 'almond', modifierGroup: { organizationId } } });
  const extraShotMod = await prisma.modifier.findFirstOrThrow({ where: { code: 'extra_shot', modifierGroup: { organizationId } } });
  const vanillaMod = await prisma.modifier.findFirstOrThrow({ where: { code: 'vanilla', modifierGroup: { organizationId } } });

  await prisma.modifierBomRule.deleteMany({ where: { modifierId: { in: [oatMod.id, almondMod.id, extraShotMod.id, vanillaMod.id] } } });

  await prisma.modifierBomRule.createMany({
    data: [
      { modifierId: oatMod.id, action: 'REPLACE', priority: 1, targetIngredientId: wholeMilk.id, replacementIngredientId: oatMilk.id },
      { modifierId: almondMod.id, action: 'REPLACE', priority: 1, targetIngredientId: wholeMilk.id, replacementIngredientId: almondMilk.id },
      { modifierId: extraShotMod.id, action: 'ADD', priority: 2, replacementIngredientId: beans.id, quantity: 7, uomId: g.id },
      { modifierId: vanillaMod.id, action: 'ADD', priority: 2, replacementIngredientId: vanilla.id, quantity: 1, uomId: pump.id },
    ],
  });

  const stockItems = [
    { ingredientId: beans.id, qty: 50000, cost: 0.05, uomId: g.id },
    { ingredientId: wholeMilk.id, qty: 50000, cost: 0.008, uomId: ml.id },
    { ingredientId: oatMilk.id, qty: 30000, cost: 0.012, uomId: ml.id },
    { ingredientId: almondMilk.id, qty: 20000, cost: 0.011, uomId: ml.id },
    { ingredientId: vanilla.id, qty: 5000, cost: 0.5, uomId: pump.id },
    { ingredientId: cup8.id, qty: 500, cost: 0.15, uomId: each.id },
    { ingredientId: cup12.id, qty: 500, cost: 0.2, uomId: each.id },
    { ingredientId: cup16.id, qty: 500, cost: 0.25, uomId: each.id },
    { ingredientId: lid.id, qty: 1000, cost: 0.05, uomId: each.id },
    { ingredientId: sleeve.id, qty: 1000, cost: 0.03, uomId: each.id },
    { ingredientId: straw.id, qty: 1000, cost: 0.02, uomId: each.id },
    { ingredientId: croissantSku.id, qty: 200, cost: 3.5, uomId: each.id },
  ];

  for (const item of stockItems) {
    const existing = await prisma.stockLayer.findFirst({
      where: { branchId, ingredientId: item.ingredientId, sourceType: 'OPENING_BALANCE' },
    });
    if (!existing) {
      await prisma.stockLayer.create({
        data: {
          branchId,
          ingredientId: item.ingredientId,
          quantityRemaining: item.qty,
          unitCost: item.cost,
          uomId: item.uomId,
          receivedAt: new Date(),
          sourceType: 'OPENING_BALANCE',
        },
      });
    }
  }

  console.log('Inventory seeded: ingredients, recipes, FIFO layers');
}

async function createApprovedRecipe(
  prisma: PrismaClient,
  menuItemId: string,
  sizeId: string,
  lines: Array<{ ingredientId: string; qty: number; uomId: string }>,
) {
  const existing = await prisma.recipe.findFirst({
    where: { menuItemId, sizeId, status: 'APPROVED', deletedAt: null },
  });

  if (existing) {
    await prisma.recipeLine.deleteMany({ where: { recipeId: existing.id } });
    await prisma.recipeLine.createMany({
      data: lines.map((line, index) => ({
        recipeId: existing.id,
        ingredientId: line.ingredientId,
        quantity: line.qty,
        uomId: line.uomId,
        sortOrder: index,
      })),
    });
    return existing;
  }

  const recipe = await prisma.recipe.create({
    data: {
      menuItemId,
      sizeId,
      status: 'APPROVED',
      approvedAt: new Date(),
      lines: {
        create: lines.map((line, index) => ({
          ingredientId: line.ingredientId,
          quantity: line.qty,
          uomId: line.uomId,
          sortOrder: index,
        })),
      },
    },
  });

  return recipe;
}

async function seedMenu(prisma: PrismaClient, organizationId: string, branchId: string) {
  const hot = await prisma.menuCategory.upsert({
    where: { organizationId_name: { organizationId, name: 'Hot Drinks' } },
    update: {},
    create: { organizationId, name: 'Hot Drinks', sortOrder: 1 },
  });

  const snacks = await prisma.menuCategory.upsert({
    where: { organizationId_name: { organizationId, name: 'Snacks' } },
    update: {},
    create: { organizationId, name: 'Snacks', sortOrder: 2 },
  });

  const cold = await prisma.menuCategory.upsert({
    where: { organizationId_name: { organizationId, name: 'Cold Drinks' } },
    update: {},
    create: { organizationId, name: 'Cold Drinks', sortOrder: 3 },
  });

  const milkGroup = await prisma.modifierGroup.upsert({
    where: { organizationId_name: { organizationId, name: 'Milk' } },
    update: {},
    create: { organizationId, name: 'Milk', minSelections: 1, maxSelections: 1, isRequired: true, sortOrder: 1 },
  });

  const extrasGroup = await prisma.modifierGroup.upsert({
    where: { organizationId_name: { organizationId, name: 'Extras' } },
    update: {},
    create: { organizationId, name: 'Extras', minSelections: 0, maxSelections: 3, sortOrder: 2 },
  });

  const wholeMilk = await prisma.modifier.upsert({
    where: { modifierGroupId_code: { modifierGroupId: milkGroup.id, code: 'whole' } },
    update: {},
    create: { modifierGroupId: milkGroup.id, name: 'Whole Milk', code: 'whole', sortOrder: 1 },
  });

  await prisma.modifier.upsert({
    where: { modifierGroupId_code: { modifierGroupId: milkGroup.id, code: 'oat' } },
    update: { priceAdjustment: 2 },
    create: { modifierGroupId: milkGroup.id, name: 'Oat Milk', code: 'oat', priceAdjustment: 2, sortOrder: 2 },
  });

  await prisma.modifier.upsert({
    where: { modifierGroupId_code: { modifierGroupId: milkGroup.id, code: 'almond' } },
    update: {},
    create: { modifierGroupId: milkGroup.id, name: 'Almond Milk', code: 'almond', priceAdjustment: 2, sortOrder: 3 },
  });

  await prisma.modifier.upsert({
    where: { modifierGroupId_code: { modifierGroupId: extrasGroup.id, code: 'extra_shot' } },
    update: {},
    create: { modifierGroupId: extrasGroup.id, name: 'Extra Shot', code: 'extra_shot', priceAdjustment: 3, sortOrder: 1 },
  });

  await prisma.modifier.upsert({
    where: { modifierGroupId_code: { modifierGroupId: extrasGroup.id, code: 'vanilla' } },
    update: {},
    create: { modifierGroupId: extrasGroup.id, name: 'Vanilla Syrup', code: 'vanilla', priceAdjustment: 1, sortOrder: 2 },
  });

  const latte = await prisma.menuItem.upsert({
    where: { organizationId_code: { organizationId, code: 'LATTE' } },
    update: { imageUrl: MENU_IMAGES.LATTE },
    create: {
      organizationId,
      categoryId: hot.id,
      name: 'Latte',
      code: 'LATTE',
      type: 'DRINK',
      basePrice: 12,
      imageUrl: MENU_IMAGES.LATTE,
      sortOrder: 1,
    },
  });

  const americano = await prisma.menuItem.upsert({
    where: { organizationId_code: { organizationId, code: 'AMERICANO' } },
    update: { imageUrl: MENU_IMAGES.AMERICANO },
    create: {
      organizationId,
      categoryId: hot.id,
      name: 'Americano',
      code: 'AMERICANO',
      type: 'DRINK',
      basePrice: 10,
      imageUrl: MENU_IMAGES.AMERICANO,
      sortOrder: 2,
    },
  });

  const icedTea = await prisma.menuItem.upsert({
    where: { organizationId_code: { organizationId, code: 'ICED_TEA' } },
    update: { imageUrl: MENU_IMAGES.ICED_TEA },
    create: {
      organizationId,
      categoryId: cold.id,
      name: 'Iced Tea',
      code: 'ICED_TEA',
      type: 'DRINK',
      basePrice: 11,
      imageUrl: MENU_IMAGES.ICED_TEA,
      sortOrder: 1,
    },
  });

  const croissant = await prisma.menuItem.upsert({
    where: { organizationId_code: { organizationId, code: 'CROISSANT' } },
    update: { imageUrl: MENU_IMAGES.CROISSANT },
    create: {
      organizationId,
      categoryId: snacks.id,
      name: 'Croissant',
      code: 'CROISSANT',
      type: 'SNACK',
      basePrice: 8,
      imageUrl: MENU_IMAGES.CROISSANT,
      sortOrder: 1,
    },
  });

  for (const item of [latte, americano, icedTea]) {
    for (const [index, size] of [
      { name: 'Small', code: 'S', adj: 0, default: false },
      { name: 'Medium', code: 'M', adj: 3, default: true },
      { name: 'Large', code: 'L', adj: 5, default: false },
    ].entries()) {
      await prisma.menuItemSize.upsert({
        where: { menuItemId_code: { menuItemId: item.id, code: size.code } },
        update: {},
        create: {
          menuItemId: item.id,
          name: size.name,
          code: size.code,
          priceAdjustment: size.adj,
          isDefault: size.default,
          sortOrder: index,
        },
      });
    }

    for (const [index, groupId] of [milkGroup.id, extrasGroup.id].entries()) {
      await prisma.menuItemModifierGroup.upsert({
        where: { menuItemId_modifierGroupId: { menuItemId: item.id, modifierGroupId: groupId } },
        update: {},
        create: { menuItemId: item.id, modifierGroupId: groupId, sortOrder: index },
      });
    }

    await prisma.branchMenuItem.upsert({
      where: { branchId_menuItemId: { branchId, menuItemId: item.id } },
      update: {},
      create: { branchId, menuItemId: item.id, isAvailable: true, is86: false },
    });
  }

  await prisma.branchMenuItem.upsert({
    where: { branchId_menuItemId: { branchId, menuItemId: croissant.id } },
    update: {},
    create: { branchId, menuItemId: croissant.id, isAvailable: true, is86: false },
  });

  console.log('Menu seeded:', { drinks: 3, snacks: 1, defaultMilk: wholeMilk.name });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

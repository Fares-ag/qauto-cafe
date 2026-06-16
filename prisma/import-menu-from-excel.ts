#!/usr/bin/env tsx
/**
 * Import café menu from transcribed Excel data (prisma/data/cafe-menu.ts).
 *
 * Usage:
 *   npx tsx prisma/import-menu-from-excel.ts --dry-run
 *   npx tsx prisma/import-menu-from-excel.ts
 *   npx tsx prisma/import-menu-from-excel.ts --file path/to/menu.xlsx   (future)
 */
import { PrismaClient } from '@prisma/client';
import {
  DEMO_MENU_CODES,
  INGREDIENT_MASTER,
  MENU_ROWS,
  type MenuRowInput,
  type RecipeLineInput,
} from './data/cafe-menu';

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes('--dry-run');
const TOLERANCE = 0.05;

type IngredientMap = Map<string, { id: string; baseUomId: string }>;
type UomMap = Map<string, string>;

function deriveIngredientUnitCosts(
  rows: MenuRowInput[],
): Map<string, number> {
  const sums = new Map<string, { total: number; weight: number }>();

  for (const row of rows) {
    if (!row.costPrice || row.lines.length === 0) continue;
    const qtySum = row.lines.reduce((s, l) => s + l.quantity, 0);
    if (qtySum <= 0) continue;
    for (const line of row.lines) {
      const share = (row.costPrice * line.quantity) / qtySum;
      const prev = sums.get(line.ingredientCode) ?? { total: 0, weight: 0 };
      sums.set(line.ingredientCode, {
        total: prev.total + share,
        weight: prev.weight + line.quantity,
      });
    }
  }

  const costs = new Map<string, number>();
  for (const [code, { total, weight }] of sums) {
    if (weight > 0) costs.set(code, total / weight);
  }

  for (const row of rows) {
    if (row.snackSku) {
      costs.set(row.snackSku.ingredientCode, row.snackSku.unitCost);
    }
  }

  return costs;
}

async function resolveOrgAndBranch() {
  const org = await prisma.organization.findFirst({
    where: { OR: [{ slug: 'qauto' }, { name: { contains: 'QAuto', mode: 'insensitive' } }] },
  });
  if (!org) throw new Error('Organization not found — run seed first');

  const branch = await prisma.branch.findFirst({
    where: { organizationId: org.id, code: 'MAIN' },
  });
  if (!branch) throw new Error('Branch MAIN not found — run seed first');

  return { org, branch };
}

async function ensureUoms(): Promise<UomMap> {
  const defaults = [
    { code: 'g', name: 'Gram', symbol: 'g' },
    { code: 'ml', name: 'Millilitre', symbol: 'ml' },
    { code: 'each', name: 'Each', symbol: 'ea' },
  ];
  const map: UomMap = new Map();
  for (const u of defaults) {
    if (DRY_RUN) {
      map.set(u.code, `dry-${u.code}`);
      continue;
    }
    const row = await prisma.uom.upsert({
      where: { code: u.code },
      update: {},
      create: u,
    });
    map.set(u.code, row.id);
  }
  return map;
}

async function upsertIngredients(
  organizationId: string,
  uomMap: UomMap,
  unitCosts: Map<string, number>,
): Promise<IngredientMap> {
  const map: IngredientMap = new Map();
  for (const ing of INGREDIENT_MASTER) {
    const baseUomId = uomMap.get(ing.baseUomCode);
    if (!baseUomId) throw new Error(`Missing UOM ${ing.baseUomCode}`);

    if (DRY_RUN) {
      map.set(ing.code, { id: `dry-${ing.code}`, baseUomId });
      continue;
    }

    let categoryId: string | undefined;
    if (ing.category) {
      const cat = await prisma.ingredientCategory.upsert({
        where: { organizationId_name: { organizationId, name: ing.category } },
        update: {},
        create: { organizationId, name: ing.category },
      });
      categoryId = cat.id;
    }

    const row = await prisma.ingredient.upsert({
      where: { organizationId_code: { organizationId, code: ing.code } },
      update: { name: ing.name, isActive: true, deletedAt: null },
      create: {
        organizationId,
        categoryId,
        code: ing.code,
        name: ing.name,
        baseUomId,
        isPackaging: ing.isPackaging ?? false,
        isSnackSku: ing.isSnackSku ?? false,
      },
    });
    map.set(ing.code, { id: row.id, baseUomId: row.baseUomId });
  }
  return map;
}

async function upsertStockLayers(
  branchId: string,
  ingredientMap: IngredientMap,
  unitCosts: Map<string, number>,
  uomMap: UomMap,
) {
  for (const [code, cost] of unitCosts) {
    const ing = ingredientMap.get(code);
    if (!ing || DRY_RUN) continue;

    const uomId = uomMap.get(
      INGREDIENT_MASTER.find((i) => i.code === code)?.baseUomCode ?? 'each',
    )!;
    const existing = await prisma.stockLayer.findFirst({
      where: { branchId, ingredientId: ing.id, sourceType: 'OPENING_BALANCE' },
    });
    const qty = INGREDIENT_MASTER.find((i) => i.code === code)?.isSnackSku ? 500 : 50000;
    if (existing) {
      await prisma.stockLayer.update({
        where: { id: existing.id },
        data: { unitCost: cost, quantityRemaining: qty, uomId },
      });
    } else {
      await prisma.stockLayer.create({
        data: {
          branchId,
          ingredientId: ing.id,
          quantityRemaining: qty,
          unitCost: cost,
          uomId,
          receivedAt: new Date(),
          sourceType: 'OPENING_BALANCE',
        },
      });
    }
  }
}

async function ensureDefaultSize(menuItemId: string) {
  if (DRY_RUN) return 'dry-size-std';
  const existing = await prisma.menuItemSize.findFirst({
    where: { menuItemId, code: 'STD', deletedAt: null },
  });
  if (existing) return existing.id;
  const size = await prisma.menuItemSize.create({
    data: {
      menuItemId,
      name: 'Standard',
      code: 'STD',
      isDefault: true,
      sortOrder: 0,
    },
  });
  return size.id;
}

async function upsertApprovedRecipe(
  menuItemId: string,
  sizeId: string,
  lines: RecipeLineInput[],
  ingredientMap: IngredientMap,
  uomMap: UomMap,
) {
  const recipeLines = lines.map((line, index) => {
    const ing = ingredientMap.get(line.ingredientCode);
    if (!ing) throw new Error(`Unknown ingredient ${line.ingredientCode}`);
    const uomId = uomMap.get(line.uomCode);
    if (!uomId) throw new Error(`Unknown UOM ${line.uomCode}`);
    return {
      ingredientId: ing.id,
      quantity: line.quantity,
      uomId,
      sortOrder: index,
    };
  });

  if (DRY_RUN) return;

  let recipe = await prisma.recipe.findFirst({
    where: { menuItemId, sizeId, status: 'APPROVED', deletedAt: null },
  });

  if (recipe) {
    await prisma.recipeLine.deleteMany({ where: { recipeId: recipe.id } });
    await prisma.recipeLine.createMany({
      data: recipeLines.map((l) => ({ ...l, recipeId: recipe!.id })),
    });
  } else {
    recipe = await prisma.recipe.create({
      data: {
        menuItemId,
        sizeId,
        status: 'APPROVED',
        approvedAt: new Date(),
        lines: { create: recipeLines },
      },
    });
  }
}

async function deactivateDemoItems(organizationId: string, importCodes: Set<string>) {
  if (DRY_RUN) return;
  const toDeactivate = DEMO_MENU_CODES.filter((c) => !importCodes.has(c));
  if (toDeactivate.length === 0) return;
  await prisma.menuItem.updateMany({
    where: { organizationId, code: { in: toDeactivate } },
    data: { isActive: false, deletedAt: new Date() },
  });
}

function computeRecipeCost(
  lines: RecipeLineInput[],
  unitCosts: Map<string, number>,
): number {
  return lines.reduce((sum, line) => {
    const cost = unitCosts.get(line.ingredientCode) ?? 0;
    return sum + cost * line.quantity;
  }, 0);
}

async function runValidation(
  rows: MenuRowInput[],
  unitCosts: Map<string, number>,
  organizationId: string,
  branchId: string,
) {
  console.log('\n========== IMPORT VALIDATION REPORT ==========\n');
  let issues = 0;

  if (DRY_RUN) {
    console.log(`Planned import: ${rows.length} menu items, ${INGREDIENT_MASTER.length} ingredients`);
    for (const row of rows) {
      console.log(`  • ${row.name} (${row.code}) — sell ${row.sellingPrice} QAR`);
      if (row.costPrice != null && row.lines.length > 0) {
        const computed = computeRecipeCost(row.lines, unitCosts);
        const delta = Math.abs(computed - row.costPrice);
        if (delta > TOLERANCE) {
          console.log(
            `    ⚠ Cost drift: Excel ${row.costPrice.toFixed(2)} vs computed ${computed.toFixed(2)}`,
          );
        }
      }
      if (row.notes) console.log(`    ℹ ${row.notes}`);
    }
    console.log(`\nIssues: 0 (dry run — no DB checks)\n==============================================\n`);
    return 0;
  }

  const dbItems = await prisma.menuItem.findMany({
    where: { organizationId, deletedAt: null },
    include: {
      sizes: { where: { deletedAt: null } },
      recipes: {
        where: { deletedAt: null, status: 'APPROVED' },
        include: { lines: { include: { ingredient: true, uom: true } } },
      },
    },
  });
  const dbByCode = new Map(dbItems.map((i) => [i.code, i]));
  const importCodes = new Set(rows.map((r) => r.code));

  for (const row of rows) {
    const dbItem = dbByCode.get(row.code);

    if (!dbItem) {
      console.log(`✗ Missing menu item: ${row.code}`);
      issues++;
      continue;
    }

    if (Math.abs(Number(dbItem.basePrice) - row.sellingPrice) > 0.01) {
      console.log(
        `✗ Price mismatch ${row.code}: DB ${dbItem.basePrice} vs Excel ${row.sellingPrice}`,
      );
      issues++;
    } else {
      console.log(`✓ ${row.name} — sell ${row.sellingPrice} QAR`);
    }

    if (row.lines.length > 0) {
      const size = dbItem.sizes.find((s) => s.code === 'STD') ?? dbItem.sizes[0];
      const recipe = dbItem.recipes.find((r) => r.sizeId === size?.id);
      if (!recipe) {
        console.log(`  ✗ No APPROVED recipe for ${row.code}`);
        issues++;
      } else {
        for (const expected of row.lines) {
          const ingCode = expected.ingredientCode;
          const dbLine = recipe.lines.find((l) => l.ingredient.code === ingCode);
          if (!dbLine) {
            console.log(`  ✗ Missing recipe line: ${ingCode}`);
            issues++;
          } else if (
            Math.abs(Number(dbLine.quantity) - expected.quantity) > 0.001 ||
            dbLine.uom.code !== expected.uomCode
          ) {
            console.log(
              `  ✗ Line mismatch ${ingCode}: DB ${dbLine.quantity}${dbLine.uom.code} vs Excel ${expected.quantity}${expected.uomCode}`,
            );
            issues++;
          }
        }
        if (recipe.status !== 'APPROVED') {
          console.log(`  ✗ Recipe not APPROVED`);
          issues++;
        }
      }

      if (row.costPrice != null) {
        const computed = computeRecipeCost(row.lines, unitCosts);
        const delta = Math.abs(computed - row.costPrice);
        if (delta > TOLERANCE) {
          console.log(
            `  ⚠ Cost drift: Excel ${row.costPrice.toFixed(2)} vs computed ${computed.toFixed(2)} (Δ ${delta.toFixed(2)})`,
          );
          if (row.notes) console.log(`    Note: ${row.notes}`);
        } else {
          console.log(`  ✓ Recipe cost ~${row.costPrice.toFixed(2)} QAR`);
        }
      }
    } else if (row.snackSku) {
      const ing = await prisma.ingredient.findUnique({
        where: {
          organizationId_code: { organizationId, code: row.snackSku.ingredientCode },
        },
      });
      if (dbItem.snackIngredientId !== ing?.id) {
        console.log(`  ✗ snackIngredientId not linked for ${row.code}`);
        issues++;
      }
    }

    if (row.notes && row.costPrice == null) {
      console.log(`  ℹ ${row.notes}`);
    }
  }

  const orphanItems = dbItems.filter(
    (i) => i.isActive && !importCodes.has(i.code) && !DEMO_MENU_CODES.includes(i.code),
  );
  if (orphanItems.length > 0) {
    console.log(`\n⚠ Active menu items not in Excel (${orphanItems.length}):`);
    for (const o of orphanItems) console.log(`  - ${o.code} (${o.name})`);
  }

  const usedIngredientCodes = new Set<string>();
  for (const row of rows) {
    for (const line of row.lines) usedIngredientCodes.add(line.ingredientCode);
    if (row.snackSku) usedIngredientCodes.add(row.snackSku.ingredientCode);
  }
  const dbIngredients = await prisma.ingredient.findMany({
    where: { organizationId, isActive: true, deletedAt: null },
  });
  const orphanIngs = dbIngredients.filter(
    (i) =>
      !usedIngredientCodes.has(i.code) &&
      !['ESPRESSO_BEANS', 'WHOLE_MILK', 'OAT_MILK', 'ALMOND_MILK', 'VANILLA_SYRUP', 'LID', 'SLEEVE', 'STRAW', 'CUP_12OZ', 'CROISSANT_SKU'].includes(i.code),
  );
  if (orphanIngs.length > 0) {
    console.log(`\nℹ Legacy/demo ingredients still active (${orphanIngs.length}) — safe to ignore or deactivate later`);
  }

  const layersMissing = await prisma.ingredient.findMany({
    where: {
      organizationId,
      code: { in: [...usedIngredientCodes] },
      stockLayers: { none: { branchId, sourceType: 'OPENING_BALANCE' } },
    },
  });
  if (layersMissing.length > 0) {
    console.log(`\n✗ Ingredients missing opening stock layer:`);
    for (const ing of layersMissing) {
      console.log(`  - ${ing.code}`);
      issues++;
    }
  }

  console.log(`\nTotal menu items: ${rows.length}`);
  console.log(`Issues: ${issues}`);
  console.log('==============================================\n');
  return issues;
}

async function main() {
  console.log(DRY_RUN ? '=== DRY RUN (no DB writes) ===' : '=== MENU IMPORT ===');

  const { org, branch } = await resolveOrgAndBranch();
  console.log(`Org: ${org.name} | Branch: ${branch.name}`);

  const unitCosts = deriveIngredientUnitCosts(MENU_ROWS);
  console.log(`Derived unit costs for ${unitCosts.size} ingredients`);

  const uomMap = await ensureUoms();
  const ingredientMap = await upsertIngredients(org.id, uomMap, unitCosts);

  const categoryOrder: Record<string, number> = {
    'Hot Drinks': 1,
    'Iced Drinks': 2,
    Teas: 3,
    Mocktails: 4,
    Juices: 5,
    'Soft Drinks': 6,
    Snacks: 7,
  };

  const importCodes = new Set(MENU_ROWS.map((r) => r.code));

  for (let i = 0; i < MENU_ROWS.length; i++) {
    const row = MENU_ROWS[i];
    const category = DRY_RUN
      ? { id: 'dry-cat' }
      : await prisma.menuCategory.upsert({
          where: { organizationId_name: { organizationId: org.id, name: row.category } },
          update: { sortOrder: categoryOrder[row.category] ?? 99 },
          create: {
            organizationId: org.id,
            name: row.category,
            sortOrder: categoryOrder[row.category] ?? 99,
          },
        });

    if (DRY_RUN) continue;

    let snackIngredientId: string | undefined;
    if (row.snackSku) {
      snackIngredientId = ingredientMap.get(row.snackSku.ingredientCode)?.id;
    }

    const menuItem = await prisma.menuItem.upsert({
      where: { organizationId_code: { organizationId: org.id, code: row.code } },
      update: {
        name: row.name,
        categoryId: category.id,
        type: row.type,
        basePrice: row.sellingPrice,
        snackIngredientId: snackIngredientId ?? null,
        isActive: true,
        deletedAt: null,
        sortOrder: i + 1,
      },
      create: {
        organizationId: org.id,
        categoryId: category.id,
        name: row.name,
        code: row.code,
        type: row.type,
        basePrice: row.sellingPrice,
        snackIngredientId,
        sortOrder: i + 1,
      },
    });

    await prisma.branchMenuItem.upsert({
      where: { branchId_menuItemId: { branchId: branch.id, menuItemId: menuItem.id } },
      update: { isAvailable: true, is86: false },
      create: { branchId: branch.id, menuItemId: menuItem.id },
    });

    if (row.lines.length > 0) {
      const sizeId = await ensureDefaultSize(menuItem.id);
      await upsertApprovedRecipe(menuItem.id, sizeId, row.lines, ingredientMap, uomMap);
    }
  }

  if (!DRY_RUN) {
    await upsertStockLayers(branch.id, ingredientMap, unitCosts, uomMap);
    await deactivateDemoItems(org.id, importCodes);
  }

  const issues = await runValidation(MENU_ROWS, unitCosts, org.id, branch.id);

  if (DRY_RUN) {
    console.log('Dry run complete. Re-run without --dry-run to apply.');
  } else if (issues === 0) {
    console.log('Import complete. Verify in UI: Menu, Ingredients, Menu Builder, test POS order.');
  } else {
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

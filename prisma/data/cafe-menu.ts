/**
 * QAuto Café menu — transcribed from operations Excel (June 2026).
 * Column headers: Coconut Syrup | Chocolate | Choco Sauce | Matcha | Coffee |
 * Long Life Milk | Condense Milk | Sugar | Cup | 7up | Syrup | Lemon | Mint | Orange
 */

export type MenuCategoryName =
  | 'Hot Drinks'
  | 'Iced Drinks'
  | 'Teas'
  | 'Mocktails'
  | 'Juices'
  | 'Snacks'
  | 'Soft Drinks';

export type RecipeLineInput = {
  ingredientCode: string;
  quantity: number;
  uomCode: string;
};

export type MenuRowInput = {
  name: string;
  code: string;
  category: MenuCategoryName;
  type: 'DRINK' | 'SNACK';
  sellingPrice: number;
  /** Total recipe cost from Excel (for validation). */
  costPrice?: number;
  lines: RecipeLineInput[];
  /** Pre-packaged retail item — no recipe, linked snack ingredient. */
  snackSku?: { ingredientCode: string; unitCost: number };
  notes?: string;
};

/** Ingredient master derived from Excel columns. */
export const INGREDIENT_MASTER: Array<{
  code: string;
  name: string;
  baseUomCode: string;
  isPackaging?: boolean;
  isSnackSku?: boolean;
  category?: string;
}> = [
  { code: 'COCONUT_SYRUP', name: 'Coconut Syrup', baseUomCode: 'ml', category: 'Syrups' },
  { code: 'CHOCOLATE', name: 'Chocolate', baseUomCode: 'g', category: 'Dry' },
  { code: 'CHOCO_SAUCE', name: 'Choco Sauce', baseUomCode: 'g', category: 'Syrups' },
  { code: 'MATCHA', name: 'Matcha', baseUomCode: 'g', category: 'Dry' },
  { code: 'COFFEE', name: 'Coffee', baseUomCode: 'g', category: 'Coffee' },
  { code: 'LONG_LIFE_MILK', name: 'Long Life Milk', baseUomCode: 'ml', category: 'Dairy' },
  { code: 'CONDENSED_MILK', name: 'Condense Milk', baseUomCode: 'ml', category: 'Dairy' },
  { code: 'SUGAR', name: 'Sugar', baseUomCode: 'g', category: 'Dry' },
  { code: 'CUP_4OZ', name: 'Cup 4oz', baseUomCode: 'each', isPackaging: true, category: 'Packaging' },
  { code: 'CUP_7OZ', name: 'Cup 7oz', baseUomCode: 'each', isPackaging: true, category: 'Packaging' },
  { code: 'CUP_8OZ', name: 'Cup 8oz', baseUomCode: 'each', isPackaging: true, category: 'Packaging' },
  { code: 'CUP_14OZ', name: 'Cup 14oz', baseUomCode: 'each', isPackaging: true, category: 'Packaging' },
  { code: 'CUP_16OZ', name: 'Cup 16oz', baseUomCode: 'each', isPackaging: true, category: 'Packaging' },
  { code: 'SEVEN_UP', name: '7up', baseUomCode: 'ml', category: 'Beverage' },
  { code: 'FLAVOUR_SYRUP', name: 'Syrup', baseUomCode: 'ml', category: 'Syrups' },
  { code: 'LEMON_SLICE', name: 'Lemon (slice)', baseUomCode: 'each', category: 'Fresh' },
  { code: 'MINT_LEAVES', name: 'Mint (leaf)', baseUomCode: 'each', category: 'Fresh' },
  { code: 'ORANGE_UNIT', name: 'Orange (unit)', baseUomCode: 'each', category: 'Fresh' },
  { code: 'SNACK_CROISSANT', name: 'Croissant', baseUomCode: 'each', isSnackSku: true, category: 'Snacks' },
  { code: 'SNACK_MUFFIN', name: 'Muffin', baseUomCode: 'each', isSnackSku: true, category: 'Snacks' },
  { code: 'SNACK_PROTEIN_GRANADE', name: 'Protein Bar (Granade)', baseUomCode: 'each', isSnackSku: true, category: 'Snacks' },
  { code: 'SNACK_PROTEIN_QUEST', name: 'Protein Bar (Quest)', baseUomCode: 'each', isSnackSku: true, category: 'Snacks' },
  { code: 'SNACK_KINZA_COLA', name: 'Kinza Cola', baseUomCode: 'each', isSnackSku: true, category: 'Soft Drinks' },
  { code: 'SNACK_KINZA_LEMON', name: 'Kinza Lemon', baseUomCode: 'each', isSnackSku: true, category: 'Soft Drinks' },
];

const L = (ingredientCode: string, quantity: number, uomCode: string): RecipeLineInput => ({
  ingredientCode,
  quantity,
  uomCode,
});

export const MENU_ROWS: MenuRowInput[] = [
  {
    name: 'Matcha Latte (Hot)',
    code: 'MATCHA_LATTE_HOT',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 12,
    costPrice: 4.64,
    lines: [L('MATCHA', 3, 'g'), L('LONG_LIFE_MILK', 170, 'ml'), L('CONDENSED_MILK', 30, 'ml'), L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
    notes: 'Excel row "Matcha Late" — name corrected',
  },
  {
    name: 'Hot Chocolate',
    code: 'HOT_CHOCOLATE',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 12,
    costPrice: 3.05,
    lines: [L('CHOCOLATE', 30, 'g'), L('CHOCO_SAUCE', 15, 'g'), L('LONG_LIFE_MILK', 170, 'ml'), L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
  },
  {
    name: 'Spanish Latte (Hot)',
    code: 'SPANISH_LATTE_HOT',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 4.2,
    lines: [L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 180, 'ml'), L('CONDENSED_MILK', 30, 'ml'), L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
  },
  {
    name: 'Coconut Latte (Hot)',
    code: 'COCONUT_LATTE_HOT',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 4.13,
    lines: [L('COCONUT_SYRUP', 25, 'ml'), L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 170, 'ml'), L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
    notes: 'Excel used 25g for coconut — stored as 25ml (syrup)',
  },
  {
    name: 'Mocha (Hot)',
    code: 'MOCHA_HOT',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 2.76,
    lines: [L('CHOCOLATE', 30, 'g'), L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 150, 'ml'), L('SUGAR', 10, 'g'), L('CUP_7OZ', 1, 'each')],
  },
  {
    name: 'Cappuccino (Hot)',
    code: 'CAPPUCCINO_HOT',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 3.12,
    lines: [L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 180, 'ml'), L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
  },
  {
    name: 'Flat White',
    code: 'FLAT_WHITE',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 1.8,
    lines: [L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 150, 'ml'), L('SUGAR', 10, 'g'), L('CUP_7OZ', 1, 'each')],
  },
  {
    name: 'Café Latte (Hot)',
    code: 'CAFE_LATTE_HOT',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 2.48,
    lines: [L('COFFEE', 10, 'g'), L('LONG_LIFE_MILK', 180, 'ml'), L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
  },
  {
    name: 'Cortado',
    code: 'CORTADO',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 8,
    costPrice: 2.4,
    lines: [L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 120, 'ml'), L('SUGAR', 10, 'g'), L('CUP_4OZ', 1, 'each')],
  },
  {
    name: 'Double Espresso',
    code: 'DOUBLE_ESPRESSO',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 1.56,
    lines: [L('COFFEE', 18, 'g'), L('SUGAR', 10, 'g'), L('CUP_4OZ', 1, 'each')],
  },
  {
    name: 'Americano (Hot)',
    code: 'AMERICANO_HOT',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 5,
    costPrice: 1.86,
    lines: [L('COFFEE', 19, 'g'), L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
  },
  {
    name: 'Macchiato',
    code: 'MACCHIATO',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 2.26,
    lines: [L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 100, 'ml'), L('SUGAR', 10, 'g'), L('CUP_4OZ', 1, 'each')],
  },
  {
    name: 'Espresso',
    code: 'ESPRESSO',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 7,
    costPrice: 0.92,
    lines: [L('COFFEE', 10, 'g'), L('SUGAR', 10, 'g'), L('CUP_4OZ', 1, 'each')],
  },
  {
    name: 'Turkish Coffee',
    code: 'TURKISH_COFFEE',
    category: 'Hot Drinks',
    type: 'DRINK',
    sellingPrice: 5,
    costPrice: 1.33,
    lines: [L('COFFEE', 13, 'g'), L('SUGAR', 10, 'g'), L('CUP_7OZ', 1, 'each')],
  },
  {
    name: 'Matcha Latte (Iced)',
    code: 'MATCHA_LATTE_ICED',
    category: 'Iced Drinks',
    type: 'DRINK',
    sellingPrice: 15,
    costPrice: 6.13,
    lines: [L('MATCHA', 4, 'g'), L('LONG_LIFE_MILK', 180, 'ml'), L('CONDENSED_MILK', 45, 'ml'), L('SUGAR', 10, 'g'), L('CUP_14OZ', 1, 'each')],
  },
  {
    name: 'Spanish Latte (Iced)',
    code: 'SPANISH_LATTE_ICED',
    category: 'Iced Drinks',
    type: 'DRINK',
    sellingPrice: 13,
    costPrice: 4.94,
    lines: [L('COFFEE', 18.5, 'g'), L('LONG_LIFE_MILK', 170, 'ml'), L('CONDENSED_MILK', 45, 'ml'), L('SUGAR', 10, 'g'), L('CUP_14OZ', 1, 'each')],
  },
  {
    name: 'Coconut Latte (Iced)',
    code: 'COCONUT_LATTE_ICED',
    category: 'Iced Drinks',
    type: 'DRINK',
    sellingPrice: 13,
    costPrice: 6.32,
    lines: [L('COCONUT_SYRUP', 30, 'ml'), L('COFFEE', 18.5, 'g'), L('LONG_LIFE_MILK', 170, 'ml'), L('CONDENSED_MILK', 45, 'ml'), L('SUGAR', 10, 'g'), L('CUP_14OZ', 1, 'each')],
  },
  {
    name: 'Mocha (Iced)',
    code: 'MOCHA_ICED',
    category: 'Iced Drinks',
    type: 'DRINK',
    sellingPrice: 12,
    costPrice: 4.47,
    lines: [L('CHOCOLATE', 45, 'g'), L('COFFEE', 18.5, 'g'), L('LONG_LIFE_MILK', 160, 'ml'), L('SUGAR', 10, 'g'), L('CUP_14OZ', 1, 'each')],
  },
  {
    name: 'Cappuccino (Iced)',
    code: 'CAPPUCCINO_ICED',
    category: 'Iced Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 3.25,
    lines: [L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 170, 'ml'), L('SUGAR', 10, 'g'), L('CUP_14OZ', 1, 'each')],
  },
  {
    name: 'Café Latte (Iced)',
    code: 'CAFE_LATTE_ICED',
    category: 'Iced Drinks',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 3.46,
    lines: [L('COFFEE', 18, 'g'), L('LONG_LIFE_MILK', 200, 'ml'), L('SUGAR', 10, 'g'), L('CUP_14OZ', 1, 'each')],
  },
  {
    name: 'Americano (Iced)',
    code: 'AMERICANO_ICED',
    category: 'Iced Drinks',
    type: 'DRINK',
    sellingPrice: 5,
    costPrice: 2.12,
    lines: [L('COFFEE', 18.5, 'g'), L('SUGAR', 10, 'g'), L('CUP_14OZ', 1, 'each')],
  },
  {
    name: 'Red Tea',
    code: 'RED_TEA',
    category: 'Teas',
    type: 'DRINK',
    sellingPrice: 2,
    lines: [L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
    notes: 'No cost price in Excel — stock cost derived from ingredients',
  },
  {
    name: 'Green Tea',
    code: 'GREEN_TEA',
    category: 'Teas',
    type: 'DRINK',
    sellingPrice: 2,
    lines: [L('SUGAR', 10, 'g'), L('CUP_8OZ', 1, 'each')],
  },
  ...(
    [
      ['Blue Lagoon', 'BLUE_LAGOON', 4.82],
      ['Passion Fruit', 'PASSION_FRUIT', 4.8],
      ['Strawberry', 'STRAWBERRY', 4.8],
      ['Water Melon', 'WATER_MELON', 4.8],
      ['Blueberry', 'BLUEBERRY', 4.8],
      ['Pomegranate', 'POMEGRANATE', 4.8],
      ['Peach', 'PEACH', 4.8],
    ] as const
  ).map(([name, code, costPrice]) => ({
    name,
    code,
    category: 'Mocktails' as const,
    type: 'DRINK' as const,
    sellingPrice: 12,
    costPrice,
    lines: [
      L('SUGAR', 10, 'g'),
      L('CUP_16OZ', 1, 'each'),
      L('SEVEN_UP', 150, 'ml'),
      L('FLAVOUR_SYRUP', 45, 'ml'),
      L('LEMON_SLICE', 1, 'each'),
      L('MINT_LEAVES', 4, 'each'),
    ],
  })),
  {
    name: 'Apple Juice',
    code: 'APPLE_JUICE',
    category: 'Juices',
    type: 'DRINK',
    sellingPrice: 12,
    costPrice: 2,
    lines: [L('CUP_16OZ', 1, 'each'), L('ORANGE_UNIT', 4, 'each')],
    notes: 'Excel lists Orange column qty 4 for Apple Juice',
  },
  {
    name: 'Orange Juice',
    code: 'ORANGE_JUICE',
    category: 'Juices',
    type: 'DRINK',
    sellingPrice: 10,
    costPrice: 2,
    lines: [L('CUP_16OZ', 1, 'each'), L('ORANGE_UNIT', 3, 'each')],
  },
  {
    name: 'Kinza Cola',
    code: 'KINZA_COLA',
    category: 'Soft Drinks',
    type: 'SNACK',
    sellingPrice: 5,
    lines: [],
    snackSku: { ingredientCode: 'SNACK_KINZA_COLA', unitCost: 2.5 },
    notes: 'Excel had no prices — selling 5 QAR placeholder until updated',
  },
  {
    name: 'Kinza Lemon',
    code: 'KINZA_LEMON',
    category: 'Soft Drinks',
    type: 'SNACK',
    sellingPrice: 5,
    lines: [],
    snackSku: { ingredientCode: 'SNACK_KINZA_LEMON', unitCost: 2.5 },
    notes: 'Excel had no prices — selling 5 QAR placeholder until updated',
  },
  {
    name: 'Croissant',
    code: 'CROISSANT',
    category: 'Snacks',
    type: 'SNACK',
    sellingPrice: 10,
    lines: [],
    snackSku: { ingredientCode: 'SNACK_CROISSANT', unitCost: 8 },
    notes: 'Excel cost 8 QAR; selling set to 10 (update if different)',
  },
  {
    name: 'Muffin',
    code: 'MUFFIN',
    category: 'Snacks',
    type: 'SNACK',
    sellingPrice: 8,
    lines: [],
    snackSku: { ingredientCode: 'SNACK_MUFFIN', unitCost: 6 },
  },
  {
    name: 'Protein Bar (Granade)',
    code: 'PROTEIN_BAR_GRANADE',
    category: 'Snacks',
    type: 'SNACK',
    sellingPrice: 15,
    lines: [],
    snackSku: { ingredientCode: 'SNACK_PROTEIN_GRANADE', unitCost: 9 },
    notes: 'Selling from Excel; unit cost estimated at 60% of sell',
  },
  {
    name: 'Protein Bar (Quest)',
    code: 'PROTEIN_BAR_QUEST',
    category: 'Snacks',
    type: 'SNACK',
    sellingPrice: 15.75,
    lines: [],
    snackSku: { ingredientCode: 'SNACK_PROTEIN_QUEST', unitCost: 9.45 },
  },
];

/** Legacy demo menu codes to deactivate on import. */
export const DEMO_MENU_CODES = ['LATTE', 'AMERICANO', 'ICED_TEA', 'CROISSANT_SKU'];

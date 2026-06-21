import type {
  CartLineInput,
  MenuCatalog,
  MenuCatalogItem,
  Order,
  OrderLine,
} from '@qauto/shared-types';

const TEMP_ID_PREFIX = 'pending-';

export function isPendingLineId(id: string): boolean {
  return id.startsWith(TEMP_ID_PREFIX);
}

function parseAmount(value: string): number {
  return Number.parseFloat(value) || 0;
}

function formatAmount(value: number): string {
  return value.toFixed(4);
}

export function findCatalogItem(
  catalog: MenuCatalog,
  menuItemId: string,
): MenuCatalogItem | undefined {
  for (const category of catalog.categories) {
    const item = category.items.find((i) => i.id === menuItemId);
    if (item) return item;
  }
  return undefined;
}

function lineInputKey(
  input: Pick<CartLineInput, 'menuItemId' | 'sizeId' | 'notes' | 'modifierIds'>,
): string {
  const modifierIds = [...(input.modifierIds ?? [])].sort().join(',');
  return `${input.menuItemId}|${input.sizeId ?? ''}|${input.notes ?? ''}|${modifierIds}`;
}

function linesMatch(
  line: OrderLine,
  input: Pick<CartLineInput, 'menuItemId' | 'sizeId' | 'notes' | 'modifierIds'>,
): boolean {
  return (
    lineInputKey({
      menuItemId: line.menuItemId,
      sizeId: line.sizeId ?? undefined,
      notes: line.notes ?? undefined,
      modifierIds: line.modifiers.map((m) => m.modifierId),
    }) === lineInputKey(input)
  );
}

function scaleLineAmounts(line: OrderLine, quantity: number): OrderLine {
  const unitPrice = parseAmount(line.unitPrice);
  const lineSubtotal = unitPrice * quantity;
  const discountRatio =
    parseAmount(line.lineSubtotal) > 0
      ? parseAmount(line.lineDiscount) / parseAmount(line.lineSubtotal)
      : 0;
  const taxRatio =
    parseAmount(line.lineSubtotal) > 0
      ? parseAmount(line.lineTax) / parseAmount(line.lineSubtotal)
      : 0;
  const lineDiscount = lineSubtotal * discountRatio;
  const taxable = lineSubtotal - lineDiscount;
  const lineTax = taxable * taxRatio;
  const lineTotal = taxable + lineTax;

  return {
    ...line,
    quantity,
    lineSubtotal: formatAmount(lineSubtotal),
    lineDiscount: formatAmount(lineDiscount),
    lineTax: formatAmount(lineTax),
    lineTotal: formatAmount(lineTotal),
  };
}

function resolveLinePricing(item: MenuCatalogItem, input: CartLineInput): Omit<OrderLine, 'id'> {
  let sizeId: string | null = null;
  let sizeName: string | null = null;
  let sizeAdjustment = 0;

  if (item.type === 'DRINK') {
    const size =
      item.sizes.find((s) => s.id === input.sizeId) ??
      item.sizes.find((s) => s.isDefault) ??
      item.sizes[0];
    if (size) {
      sizeId = size.id;
      sizeName = size.name;
      sizeAdjustment = parseAmount(size.priceAdjustment);
    }
  }

  const modifiers = (input.modifierIds ?? []).flatMap((modifierId) => {
    for (const group of item.modifierGroups) {
      const mod = group.modifiers.find((m) => m.id === modifierId);
      if (mod) {
        return [
          {
            id: `pending-mod-${modifierId}`,
            modifierId: mod.id,
            name: mod.name,
            priceAdjustment: mod.priceAdjustment,
          },
        ];
      }
    }
    return [];
  });

  const modifierTotal = modifiers.reduce(
    (sum, modifier) => sum + parseAmount(modifier.priceAdjustment),
    0,
  );
  const unitPrice = parseAmount(item.basePrice) + sizeAdjustment + modifierTotal;
  const lineSubtotal = unitPrice * input.quantity;
  const lineDiscount = 0;
  const taxRate = parseAmount(item.taxRate ?? '0');
  const taxable = lineSubtotal - lineDiscount;
  const lineTax = taxable * taxRate;
  const lineTotal = taxable + lineTax;

  return {
    menuItemId: item.id,
    sizeId,
    itemName: item.name,
    sizeName,
    quantity: input.quantity,
    unitPrice: formatAmount(unitPrice),
    lineSubtotal: formatAmount(lineSubtotal),
    lineDiscount: formatAmount(lineDiscount),
    lineTax: formatAmount(lineTax),
    lineTotal: formatAmount(lineTotal),
    notes: input.notes ?? null,
    modifiers,
  };
}

function sumOrderTotals(lines: OrderLine[]) {
  const subtotal = lines.reduce((sum, line) => sum + parseAmount(line.lineSubtotal), 0);
  const discountTotal = lines.reduce((sum, line) => sum + parseAmount(line.lineDiscount), 0);
  const taxTotal = lines.reduce((sum, line) => sum + parseAmount(line.lineTax), 0);
  const total = lines.reduce((sum, line) => sum + parseAmount(line.lineTotal), 0);

  return {
    subtotal: formatAmount(subtotal),
    discountTotal: formatAmount(discountTotal),
    taxTotal: formatAmount(taxTotal),
    total: formatAmount(total),
  };
}

function withLineTotals(order: Order, lines: OrderLine[]): Order {
  return { ...order, lines, ...sumOrderTotals(lines) };
}

export function applyOptimisticAddLine(
  order: Order,
  catalog: MenuCatalog,
  input: CartLineInput,
): Order {
  const item = findCatalogItem(catalog, input.menuItemId);
  if (!item) return order;

  const existingIndex = order.lines.findIndex((line) => linesMatch(line, input));
  if (existingIndex >= 0) {
    const lines = order.lines.map((line, index) =>
      index === existingIndex
        ? scaleLineAmounts(line, line.quantity + input.quantity)
        : line,
    );
    return withLineTotals(order, lines);
  }

  const pricing = resolveLinePricing(item, input);
  const newLine: OrderLine = {
    ...pricing,
    id: `${TEMP_ID_PREFIX}${crypto.randomUUID()}`,
  };

  return withLineTotals(order, [...order.lines, newLine]);
}

export function applyOptimisticUpdateQuantity(
  order: Order,
  lineIndex: number,
  quantity: number,
): Order {
  const line = order.lines[lineIndex];
  if (!line) return order;

  if (quantity <= 0) {
    const lines = order.lines.filter((_, index) => index !== lineIndex);
    return withLineTotals(order, lines);
  }

  const lines = order.lines.map((current, index) =>
    index === lineIndex ? scaleLineAmounts(current, quantity) : current,
  );
  return withLineTotals(order, lines);
}

export function applyOptimisticRemoveLine(order: Order, lineIndex: number): Order {
  const lines = order.lines.filter((_, index) => index !== lineIndex);
  return withLineTotals(order, lines);
}

export function applyOptimisticClearLines(order: Order): Order {
  return {
    ...order,
    lines: [],
    subtotal: '0.0000',
    discountTotal: '0.0000',
    taxTotal: '0.0000',
    total: '0.0000',
  };
}

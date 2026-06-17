export interface MenuModifier {
  id: string;
  name: string;
  code: string;
  priceAdjustment: string;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  modifiers: MenuModifier[];
}

export interface MenuSize {
  id: string;
  name: string;
  code: string;
  priceAdjustment: string;
  isDefault: boolean;
}

export interface MenuCatalogItem {
  id: string;
  name: string;
  code: string;
  type: 'DRINK' | 'SNACK';
  description: string | null;
  imageUrl: string | null;
  basePrice: string;
  is86: boolean;
  isAvailable: boolean;
  sizes: MenuSize[];
  modifierGroups: MenuModifierGroup[];
}

export interface MenuCategory {
  id: string;
  name: string;
  sortOrder: number;
  items: MenuCatalogItem[];
}

export interface MenuCatalog {
  branchId: string;
  categories: MenuCategory[];
}

export type OrderType = 'COUNTER' | 'TAKEAWAY' | 'STAFF' | 'COMP';

export interface OrderDiscount {
  id: string;
  scope: 'LINE' | 'ORDER';
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: string;
  amount: string;
  reason: string | null;
  orderLineId: string | null;
}

export interface OrderLineModifier {
  id: string;
  modifierId: string;
  name: string;
  priceAdjustment: string;
}

export interface OrderLine {
  id: string;
  menuItemId: string;
  sizeId: string | null;
  itemName: string;
  sizeName: string | null;
  quantity: number;
  unitPrice: string;
  lineSubtotal: string;
  lineDiscount: string;
  lineTax: string;
  lineTotal: string;
  notes: string | null;
  modifiers: OrderLineModifier[];
}

export type BillingParty = 'INDIVIDUAL' | 'DEPARTMENT';

export interface Order {
  id: string;
  branchId: string;
  orderNumber: number;
  status: string;
  orderType: OrderType;
  customerName: string | null;
  customerDepartment?: string | null;
  billingParty?: BillingParty;
  guestName?: string | null;
  deferredAt?: string | null;
  paymentDueDate?: string | null;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  createdAt: string;
  updatedAt: string;
  cogsTotal?: string;
  paidAt?: string;
  discounts?: OrderDiscount[];
  lines: OrderLine[];
}

export interface UnpaidOrdersReport {
  branchId: string;
  orderCount: number;
  outstandingTotal: string;
  orders: Array<{
    id: string;
    orderNumber: number;
    status: string;
    customerName: string | null;
    customerDepartment: string | null;
    total: string;
    deferredAt: string | null;
    paymentDueDate: string | null;
  }>;
}

export interface PayOrderResponse {
  order: {
    id: string;
    orderNumber: number;
    status: string;
    total: string;
    cogsTotal: string;
    paidAt?: string;
  };
  receipt: unknown;
  consumption: Array<{
    orderLineId: string;
    itemName: string;
    cogs: string;
    ingredients?: Array<{ name: string; quantity: string; cost: string }>;
  }>;
}

export interface StockShortageError {
  ingredientId: string;
  ingredientName: string;
  required: string;
  available: string;
  uom: string;
}

export interface CartLineInput {
  menuItemId: string;
  sizeId?: string;
  quantity: number;
  modifierIds?: string[];
  notes?: string;
}

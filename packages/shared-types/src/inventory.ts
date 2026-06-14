export interface StockMovementRow {
  id: string;
  type: string;
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  uom?: string;
  unitCost: string;
  extendedCost: string;
  notes: string | null;
  createdByName: string | null;
  createdAt: string;
}
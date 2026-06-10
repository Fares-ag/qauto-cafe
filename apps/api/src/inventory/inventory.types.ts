import { Prisma } from '@prisma/client';

export interface StockShortage {
  ingredientId: string;
  ingredientName: string;
  required: string;
  available: string;
  uom: string;
}

export class InsufficientStockError extends Error {
  constructor(public readonly shortages: StockShortage[]) {
    super('Insufficient stock');
    this.name = 'InsufficientStockError';
  }
}

export interface LayerAllocation {
  layerId: string;
  ingredientId: string;
  quantity: Prisma.Decimal;
  unitCost: Prisma.Decimal;
  extendedCost: Prisma.Decimal;
}

export interface ConsumptionLineInput {
  ingredientId: string;
  ingredientName: string;
  quantity: Prisma.Decimal;
  uomId: string;
  uomCode: string;
}

export interface ConsumptionResult {
  allocations: LayerAllocation[];
  totalCost: Prisma.Decimal;
}

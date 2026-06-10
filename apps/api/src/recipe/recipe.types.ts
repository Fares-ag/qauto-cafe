import { Prisma } from '@prisma/client';

export interface ResolvedBomLine {
  ingredientId: string;
  ingredientName: string;
  quantity: Prisma.Decimal;
  uomId: string;
  uomCode: string;
}

export interface ResolveBomInput {
  menuItemId: string;
  sizeId?: string | null;
  modifierIds: string[];
  quantity: number;
}

import { Prisma } from '@prisma/client';

export function decimalToNumber(value: Prisma.Decimal | number | string): number {
  return new Prisma.Decimal(value).toNumber();
}

export function decimalToString(value: Prisma.Decimal | number | string): string {
  return new Prisma.Decimal(value).toFixed(4);
}

export function sumDecimals(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((acc, v) => acc.add(v), new Prisma.Decimal(0));
}

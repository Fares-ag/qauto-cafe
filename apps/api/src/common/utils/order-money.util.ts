import { DiscountType, Prisma } from '@prisma/client';

/** Pre-discount / fixed discount amount for a single base (line subtotal or order subtotal). */
export function computeDiscountAmount(
  base: Prisma.Decimal,
  type: DiscountType,
  value: Prisma.Decimal,
): Prisma.Decimal {
  if (type === DiscountType.PERCENTAGE) {
    return base.mul(value).div(100);
  }
  return Prisma.Decimal.min(value, base);
}

/** Recompute line tax/total after discount, preserving the original tax rate implied by pre-discount amounts. */
export function computeLineTotalsAfterDiscount(
  lineSubtotal: Prisma.Decimal,
  lineTax: Prisma.Decimal,
  lineDiscount: Prisma.Decimal,
): { lineDiscount: Prisma.Decimal; lineTax: Prisma.Decimal; lineTotal: Prisma.Decimal } {
  const cappedDiscount = Prisma.Decimal.min(lineDiscount, lineSubtotal);
  const taxRate = lineSubtotal.gt(0) ? lineTax.div(lineSubtotal) : new Prisma.Decimal(0);
  const taxable = lineSubtotal.sub(cappedDiscount);
  const nextLineTax = taxable.mul(taxRate);
  const lineTotal = taxable.add(nextLineTax);

  return {
    lineDiscount: cappedDiscount,
    lineTax: nextLineTax,
    lineTotal,
  };
}

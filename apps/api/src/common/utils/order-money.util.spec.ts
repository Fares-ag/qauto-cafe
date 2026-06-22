import { DiscountType, Prisma } from '@prisma/client';
import {
  computeDiscountAmount,
  computeLineTotalsAfterDiscount,
} from './order-money.util';

describe('order-money.util', () => {
  describe('computeDiscountAmount', () => {
    it('applies percentage discount to base', () => {
      const amount = computeDiscountAmount(
        new Prisma.Decimal('100.0000'),
        DiscountType.PERCENTAGE,
        new Prisma.Decimal('10'),
      );
      expect(amount.toFixed(4)).toBe('10.0000');
    });

    it('caps fixed discount at base', () => {
      const amount = computeDiscountAmount(
        new Prisma.Decimal('5.0000'),
        DiscountType.FIXED_AMOUNT,
        new Prisma.Decimal('12.0000'),
      );
      expect(amount.toFixed(4)).toBe('5.0000');
    });
  });

  describe('computeLineTotalsAfterDiscount', () => {
    it('recalculates tax on discounted taxable amount', () => {
      const result = computeLineTotalsAfterDiscount(
        new Prisma.Decimal('10.0000'),
        new Prisma.Decimal('0.5000'),
        new Prisma.Decimal('2.0000'),
      );

      expect(result.lineDiscount.toFixed(4)).toBe('2.0000');
      expect(result.lineTax.toFixed(4)).toBe('0.4000');
      expect(result.lineTotal.toFixed(4)).toBe('8.4000');
    });

    it('never discounts below zero', () => {
      const result = computeLineTotalsAfterDiscount(
        new Prisma.Decimal('3.0000'),
        new Prisma.Decimal('0.1500'),
        new Prisma.Decimal('10.0000'),
      );

      expect(result.lineDiscount.toFixed(4)).toBe('3.0000');
      expect(result.lineTotal.toFixed(4)).toBe('0.0000');
    });
  });
});

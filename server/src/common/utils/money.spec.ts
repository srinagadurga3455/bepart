import { BadRequestException } from '@nestjs/common';
import {
  assertRupees,
  paiseToRupees,
  rupeesToPaise,
  toRupeesBalance,
  toRupeesCoupon,
  toRupeesPayment,
  toRupeesQuote,
  toRupeesRegistration,
  toRupeesWithdrawal,
} from './money';

describe('money utils (rupees at API, paise in storage/Razorpay)', () => {
  it('converts rupees to paise for storage/Razorpay', () => {
    expect(rupeesToPaise(500)).toBe(50000);
    expect(rupeesToPaise(999)).toBe(99900);
    expect(rupeesToPaise(499.5)).toBe(49950);
    expect(rupeesToPaise(0.01)).toBe(1);
  });

  it('converts paise to rupees for API responses', () => {
    expect(paiseToRupees(50000)).toBe(500);
    expect(paiseToRupees(49950)).toBe(499.5);
    expect(paiseToRupees(0)).toBe(0);
  });

  it('accepts valid rupee amounts', () => {
    expect(assertRupees(500)).toBe(500);
    expect(assertRupees(499.5)).toBe(499.5);
    expect(assertRupees(0.01)).toBe(0.01);
  });

  it('rejects non-numbers, zero/negatives and >2 decimal places', () => {
    expect(() => assertRupees('500' as any)).toThrow(BadRequestException);
    expect(() => assertRupees(NaN)).toThrow(BadRequestException);
    expect(() => assertRupees(0)).toThrow(BadRequestException);
    expect(() => assertRupees(-100)).toThrow(BadRequestException);
    expect(() => assertRupees(10.123)).toThrow(BadRequestException);
    expect(() => assertRupees(undefined)).toThrow(BadRequestException);
  });

  it('maps stored payments (paise) to rupees responses', () => {
    expect(toRupeesPayment({ amount: 45000, originalAmount: 50000, discountAmount: 5000 } as any)).toEqual(
      expect.objectContaining({ amount: 450, originalAmount: 500, discountAmount: 50 }),
    );
    // Null snapshots (pre-feature rows) survive untouched.
    expect(toRupeesPayment({ amount: 50000, originalAmount: null, discountAmount: 0 } as any)).toEqual(
      expect.objectContaining({ amount: 500, originalAmount: null, discountAmount: 0 }),
    );
  });

  it('maps quotes to rupees', () => {
    expect(toRupeesQuote({ originalAmount: 50000, discountAmount: 5000, totalAmount: 45000 })).toEqual({
      originalAmount: 500,
      discountAmount: 50,
      totalAmount: 450,
    });
  });

  it('maps FIXED coupons but leaves PERCENTAGE untouched', () => {
    expect(toRupeesCoupon({ discountType: 'FIXED', discountValue: 5000 } as any)).toEqual(
      expect.objectContaining({ discountValue: 50 }),
    );
    expect(toRupeesCoupon({ discountType: 'PERCENTAGE', discountValue: 20 } as any)).toEqual(
      expect.objectContaining({ discountValue: 20 }),
    );
  });

  it('maps withdrawals and balances to rupees', () => {
    expect(toRupeesWithdrawal({ amount: 20000 } as any)).toEqual(expect.objectContaining({ amount: 200 }));
    expect(toRupeesBalance({ revenue: 50000, reserved: 10000, paidOut: 20000, available: 20000 } as any)).toEqual(
      expect.objectContaining({ revenue: 500, reserved: 100, paidOut: 200, available: 200 }),
    );
  });

  it('maps registration snapshots, preserving nulls', () => {
    expect(
      toRupeesRegistration({ originalAmount: 50000, discountAmount: 10000, totalAmount: 40000 } as any),
    ).toEqual(expect.objectContaining({ originalAmount: 500, discountAmount: 100, totalAmount: 400 }));
    expect(toRupeesRegistration({ originalAmount: null, discountAmount: 0, totalAmount: null } as any)).toEqual(
      expect.objectContaining({ originalAmount: null, discountAmount: 0, totalAmount: null }),
    );
  });
});

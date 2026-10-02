import { BadRequestException } from '@nestjs/common';

/**
 * Single money convention for Pravesh.
 *
 * - API / DTOs / services / responses speak RUPEES (e.g. 500 = ₹500,
 *   499.5 = ₹499.50). Up to 2 decimal places are allowed.
 * - STORAGE (Prisma Int columns) and the RAZORPAY API speak PAISE
 *   (integers, e.g. 50000). No migration was needed: existing columns
 *   already store paise, so services convert at the boundary.
 *
 * Frontend already renders raw numbers as ₹ (see `formatINR`), so
 * returning rupees from the API matches what the UI sends and shows.
 */

/** Validate an API-facing rupee amount. Returns the value unchanged. */
export function assertRupees(value: unknown, field = 'amount'): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new BadRequestException(`${field} must be a number in rupees (e.g. 500 for ₹500)`);
  }
  if (value <= 0) {
    throw new BadRequestException(`${field} must be greater than 0 rupees`);
  }
  // paise resolution: at most 2 decimal places.
  const paise = Math.round(value * 100);
  if (Math.abs(value * 100 - paise) > 1e-6) {
    throw new BadRequestException(`${field} supports at most 2 decimal places (paise)`);
  }
  return value;
}

/** Rupees (API) -> paise (storage / Razorpay). 500 -> 50000. */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/** Paise (storage) -> rupees (API). 50000 -> 500. */
export function paiseToRupees(paise: number): number {
  return Math.round((paise / 100) * 100) / 100;
}

interface Priced {
  amount: number;
  originalAmount?: number | null;
  discountAmount?: number | null;
}

/** Map a stored payment row (paise) to an API response (rupees). */
export function toRupeesPayment<T extends Priced>(payment: T): T {
  return {
    ...payment,
    amount: paiseToRupees(payment.amount),
    originalAmount:
      payment.originalAmount === undefined || payment.originalAmount === null
        ? payment.originalAmount
        : paiseToRupees(payment.originalAmount),
    discountAmount:
      payment.discountAmount === undefined || payment.discountAmount === null
        ? payment.discountAmount
        : paiseToRupees(payment.discountAmount),
  };
}

export interface PriceQuoteAmounts {
  originalAmount: number;
  discountAmount: number;
  totalAmount: number;
}

/** Map an internal paise quote to an API-facing rupees quote. */
export function toRupeesQuote<T extends PriceQuoteAmounts>(quote: T): T {
  return {
    ...quote,
    originalAmount: paiseToRupees(quote.originalAmount),
    discountAmount: paiseToRupees(quote.discountAmount),
    totalAmount: paiseToRupees(quote.totalAmount),
  };
}

interface CouponLike {
  discountType: string;
  discountValue: number;
}

/**
 * Map a stored coupon row to an API response. FIXED discountValue is
 * stored in paise -> returned in rupees. PERCENTAGE values are percents
 * (not money) and pass through untouched.
 */
export function toRupeesCoupon<T extends CouponLike>(coupon: T): T {
  if (!coupon || coupon.discountType !== 'FIXED') return coupon;
  return { ...coupon, discountValue: paiseToRupees(coupon.discountValue) };
}

interface WithdrawalLike {
  amount: number;
}

export function toRupeesWithdrawal<T extends WithdrawalLike>(withdrawal: T): T {
  return { ...withdrawal, amount: paiseToRupees(withdrawal.amount) };
}

export interface BalanceLike {
  revenue: number;
  reserved: number;
  paidOut: number;
  available: number;
}

/** Map an internal paise balance to an API-facing rupees balance. */
export function toRupeesBalance<T extends BalanceLike>(balance: T): T {
  return {
    ...balance,
    revenue: paiseToRupees(balance.revenue),
    reserved: paiseToRupees(balance.reserved),
    paidOut: paiseToRupees(balance.paidOut),
    available: paiseToRupees(balance.available),
  };
}

interface RegistrationAmounts {
  originalAmount?: number | null;
  discountAmount?: number | null;
  totalAmount?: number | null;
}

/** Map stored registration snapshot fields (paise) to API rupees. */
export function toRupeesRegistration<T extends RegistrationAmounts>(registration: T): T {
  const map = (v: number | null | undefined) =>
    v === undefined || v === null ? v : paiseToRupees(v);
  return {
    ...registration,
    originalAmount: map(registration.originalAmount),
    discountAmount: map(registration.discountAmount),
    totalAmount: map(registration.totalAmount),
  };
}

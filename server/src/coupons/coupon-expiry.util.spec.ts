import { isCouponExpired } from './coupon-expiry.util';

describe('isCouponExpired (UTC)', () => {
  it('should accept null/undefined (no expiry)', () => {
    expect(isCouponExpired(null)).toBe(false);
    expect(isCouponExpired(undefined)).toBe(false);
  });

  it('should accept future Date and future ISO string', () => {
    const now = Date.now();
    expect(isCouponExpired(new Date(now + 3600000), now)).toBe(false);
    expect(isCouponExpired(new Date(now + 3600000).toISOString(), now)).toBe(false);
    expect(isCouponExpired('2026-12-31T23:59:59.000Z', now)).toBe(false);
  });

  it('should reject past Date and past ISO string (e.g. 2025-12-31 when now is Sep 2026)', () => {
    const now = new Date('2026-09-25T00:00:00.000Z').getTime();
    expect(isCouponExpired(new Date(now - 3600000), now)).toBe(true);
    expect(isCouponExpired('2025-12-31T23:59:59.000Z', now)).toBe(true);
  });

  it('should fail closed on unparseable value (never bypass validation)', () => {
    expect(isCouponExpired('not-a-date' as any)).toBe(true);
  });
});

/**
 * Single source of truth for coupon expiry comparison.
 *
 * Prisma returns `expiresAt` as a `Date`, but serialized values (logs, mocks,
 * API payloads) may arrive as ISO strings. Both represent an absolute instant;
 * `getTime()` compares them in UTC millis, independent of server timezone.
 *
 * - `null`/`undefined` => no expiry => NOT expired.
 * - Unparseable value => fail closed => treated as expired (never bypass validation).
 */
export function isCouponExpired(
  expiresAt: Date | string | null | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!expiresAt) return false;
  const t = new Date(expiresAt).getTime();
  if (Number.isNaN(t)) return true;
  return nowMs > t;
}

/**
 * Normalize phone numbers consistently:
 * - trim
 * - remove spaces, hyphens and parentheses
 * Keep leading '+' if present.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-\(\)]/g, '');
}

/**
 * Canonical phone for payment/registration lookup:
 * - remove all non-digits
 * - take last 10 digits (Indian mobile)
 * Ensures +91 9123456789, +919123456789 and 9123456789 are identical
 */
export function toCanonicalPhone(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

/**
 * Shared backend phone normalization for Payment and Registration operations.
 * Use this consistently for phone storage and lookup.
 */
export function canonicalPhone(phone: string): string {
  return toCanonicalPhone(phone);
}

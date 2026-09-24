/**
 * Normalize phone numbers consistently:
 * - trim
 * - remove spaces, hyphens and parentheses
 * Keep leading '+' if present.
 */
export function normalizePhone(phone: string): string {
  return phone.trim().replace(/[\s\-\(\)]/g, '');
}

// Shared frontend validators (mirror server/src/common/constants/validation.ts).
// Every form in the app should use these instead of inline regexes.

export const EMAIL_REGEX = /^\S+@\S+\.\S+$/;
export const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;

// UPI VPA format: <handle>@<bank>
// handle: 3–256 chars, alphanumeric plus . _ - (no leading/trailing or consecutive special chars)
// bank:   2–64 chars, alphanumeric plus . - (no leading/trailing dots/hyphens)
// Mirrors server/src/common/constants/validation.ts UPI_ID_REGEX.
export const UPI_ID_REGEX =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,254}[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]{0,62}[a-zA-Z0-9]$/;

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email is required';
  return EMAIL_REGEX.test(value.trim()) ? null : 'Enter a valid email';
}

export function validatePhone(value: string, required = false): string | null {
  const clean = value.trim();
  if (!clean) return required ? 'Phone number is required' : null;
  return PHONE_REGEX.test(clean) ? null : 'Enter a valid phone number';
}

export function validateUpiId(value: string, required = true): string | null {
  const clean = value.trim();
  if (!clean) return required ? 'UPI ID is required' : null;
  return UPI_ID_REGEX.test(clean) ? null : 'Enter a valid UPI ID (e.g. club@okhdfc)';
}

export function validateRequired(value: string, label: string): string | null {
  return value.trim() ? null : `${label} is required`;
}

// ── Local date/time helpers ──────────────────────────────────────────────
// datetime-local inputs yield "YYYY-MM-DDTHH:mm" with NO timezone. Parsing
// them with `new Date(string)` is implementation-dependent (older Safari
// treats the value as UTC, shifting IST times by +5:30). These helpers parse
// the components explicitly so the value is ALWAYS the organizer's local
// time; comparisons below use epoch-ms timestamps, so UTC storage
// (toISOString) stays correct regardless of timezone.

const LOCAL_DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/;

/** Parse a datetime-local value (or date+time pair) as LOCAL time → epoch ms, or null if invalid. */
export function parseLocalDateTime(value: string): number | null {
  const m = LOCAL_DATETIME_PATTERN.exec(value.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(
    parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10),
    parseInt(h, 10), parseInt(mi, 10), s ? parseInt(s, 10) : 0, 0,
  );
  return isNaN(date.getTime()) ? null : date.getTime();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Smallest datetime-local value that is guaranteed future: datetime-local has
 *  minute precision, so the current minute is already past to the second and
 *  would instantly fail "must be in the future" validation. Used for picker
 *  `min` attributes (validation itself stays strict timestamp comparison). */
export function nextMinuteLocalInputValue(now: Date = new Date()): string {
  return toLocalDateTimeInputValue(new Date(now.getTime() + 60000));
}

/** Format a Date as a datetime-local value in LOCAL time (for min attributes). */
export function toLocalDateTimeInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Format a Date as a date-input value in LOCAL time (for min attributes). */
export function toLocalDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

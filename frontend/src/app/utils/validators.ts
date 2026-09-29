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

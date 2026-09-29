// Central backend validation patterns (mirrors frontend src/app/utils/validators.ts).
// UPI VPA format: <handle>@<bank>
// handle: 3–256 chars, alphanumeric plus . _ - (no leading/trailing or consecutive special chars)
// bank:   2–64 chars, alphanumeric plus . - (no leading/trailing dots/hyphens)
export const UPI_ID_REGEX =
  /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,254}[a-zA-Z0-9]@[a-zA-Z0-9][a-zA-Z0-9.-]{0,62}[a-zA-Z0-9]$/;
export const UPI_ID_MESSAGE = 'Enter a valid UPI ID (e.g. club@okhdfc)';

// Phone numbers: optional leading +, digits with spaces/hyphens/parentheses.
export const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;
export const PHONE_MESSAGE = 'Enter a valid phone number';

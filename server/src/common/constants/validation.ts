// Central backend validation patterns (mirrors frontend src/app/utils/validators.ts).
// UPI IDs look like name@bank (e.g. club@okhdfc, 9876543210@upi).
// Matches CreateWithdrawalDto.UPI_ID_PATTERN.
export const UPI_ID_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9.-]{2,64}$/;
export const UPI_ID_MESSAGE =
  'Enter a valid UPI ID (e.g. club@okhdfc)';

// Phone numbers: optional leading +, digits with spaces/hyphens/parentheses.
export const PHONE_REGEX = /^\+?[0-9\s\-()]{7,20}$/;
export const PHONE_MESSAGE = 'Enter a valid phone number';

// Central BePart platform contact information (support / communication).
// These are platform constants — NOT organizer or user profile fields.
// Import from here everywhere instead of duplicating email/phone strings.
export const BEPART_SUPPORT = {
  email: 'support@bepart.in',
  phone: '+91 98765 43210',
  phoneHref: 'tel:+919876543210',
  hours: 'Mon–Sat, 9:00 AM – 7:00 PM IST',
} as const;

export const BEPART_BRAND = {
  name: 'BePart',
  tagline: 'Campus events, simplified',
} as const;

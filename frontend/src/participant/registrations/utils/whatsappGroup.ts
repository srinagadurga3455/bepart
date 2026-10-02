/**
 * Official event WhatsApp group link helpers.
 *
 * This is completely separate from WhatsApp ticket delivery: the ticket
 * notification (ticket_details template + QR) is untouched. The group link
 * is an optional post-registration convenience — the participant explicitly
 * clicks to open the organizer-configured group.
 */

/** Minimal shape needed: only the stored group link is read. */
export interface WhatsAppGroupEvent {
  whatsappGroupLink?: string | null;
}

/**
 * Return the trimmed group link, or null when the event has none
 * (null, undefined, empty, or whitespace-only). Never throws.
 */
export function getWhatsappGroupLink(event: WhatsAppGroupEvent | null | undefined): string | null {
  const raw = event?.whatsappGroupLink;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed ? trimmed : null;
}

/** Whether the Join WhatsApp Group section should render. */
export function hasWhatsappGroupLink(event: WhatsAppGroupEvent | null | undefined): boolean {
  return getWhatsappGroupLink(event) !== null;
}

/**
 * Validate a group link typed by an organizer in the event form.
 * Returns an error message, or null when the value is acceptable
 * (empty = no group, which is valid since the field is optional).
 */
export function validateWhatsappGroupLinkInput(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\/.+\..+/.test(trimmed)) {
    return 'Enter a valid URL starting with http:// or https:// (e.g. https://chat.whatsapp.com/...).';
  }
  return null;
}

import { bodyParams, imageHeader, urlButton, type WhatsappComponent } from '../whatsapp.provider';

/**
 * Pravesh template contracts — exact variable ordering from
 * `Pravesh/server/whatsapp/templates/*.js`, adapted to BePart data.
 */

export const TICKET_DETAILS_TEMPLATE = 'ticket_details';
export const PAYOUT_REQUEST_TEMPLATE = 'payout_request';
export const PAYOUT_SUCCESSFUL_TEMPLATE = 'payout_successful';
export const PAYOUT_REJECTED_TEMPLATE = 'payout_rejected';

export interface TicketDetailsParams {
  name: string;
  event: string;
  date: string;
  time: string;
  venue: string;
  /** Ticket code used for the "View My Ticket" URL button variable. */
  ticketId: string;
}

export function validateTicketDetails(p: Partial<TicketDetailsParams & { to: string }>): string | null {
  const missing = (['to', 'name', 'event', 'date', 'time', 'venue'] as const).filter((k) => !p[k]);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!p.ticketId) return 'Missing required fields: ticketId (for the View My Ticket button)';
  return null;
}

/** ticket_details: body [name, event, date, time, venue] + URL button [ticketId]. */
export function buildTicketDetailsComponents(p: TicketDetailsParams): WhatsappComponent[] {
  return [bodyParams([p.name, p.event, p.date, p.time, p.venue]), urlButton(0, [p.ticketId])];
}

export interface PayoutRequestParams {
  amount: string;
  organizer: string;
  event: string;
  requestId: string;
  payoutKey?: string;
}

export function validatePayoutRequest(p: Partial<PayoutRequestParams & { to: string }>): string | null {
  const missing = (['to', 'amount', 'organizer', 'event', 'requestId'] as const).filter((k) => !p[k]);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  return null;
}

/** payout_request: body [amount, organizer, event, requestId] + URL button [payoutKey||requestId]. */
export function buildPayoutRequestComponents(p: PayoutRequestParams): WhatsappComponent[] {
  return [
    bodyParams([p.amount, p.organizer, p.event, p.requestId]),
    urlButton(0, [p.payoutKey || p.requestId]),
  ];
}

export interface PayoutSuccessfulParams {
  name: string;
  amount: string;
  transactionId: string;
  imageUrl?: string;
  imageId?: string;
}

export function validatePayoutSuccessful(p: Partial<PayoutSuccessfulParams & { to: string }>): string | null {
  const missing = (['to', 'name', 'amount', 'transactionId'] as const).filter((k) => !p[k]);
  if (missing.length) return `Missing required fields: ${missing.join(', ')}`;
  if (!p.imageUrl && !p.imageId) return 'An image is required: provide "imageUrl" or "imageId" for the image header';
  return null;
}

/**
 * payout_successful: image header FIRST, then body [name, amount, transactionId].
 * The screenshot must be a public HTTPS URL (R2/Azure) — never `local://`.
 */
export function buildPayoutSuccessfulComponents(p: PayoutSuccessfulParams): WhatsappComponent[] {
  return [imageHeader({ imageUrl: p.imageUrl, imageId: p.imageId }), bodyParams([p.name, p.amount, p.transactionId])];
}

/** payout_successful body-only fallback (no public proof URL available). */
export function buildPayoutSuccessfulBodyOnly(p: PayoutSuccessfulParams): WhatsappComponent[] {
  return [bodyParams([p.name, p.amount, p.transactionId])];
}

export interface PayoutRejectedParams {
  organizerName: string;
  amount: string;
  requestId: string;
  reason: string;
}

/** payout_rejected: body [organizerName, amount, requestId, reason] (same convention). */
export function buildPayoutRejectedComponents(p: PayoutRejectedParams): WhatsappComponent[] {
  return [bodyParams([p.organizerName, p.amount, p.requestId, p.reason])];
}

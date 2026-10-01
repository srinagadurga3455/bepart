import client from '../../../app/api/client';
import type { CheckInResult } from '../../../app/types';

export interface TicketValidation {
  ticket: {
    id: string;
    code: string;
    status: string;
    checkedInAt?: string | null;
    ticketUrl: string;
    createdAt: string;
  };
  registration: {
    registrationId: string;
    phone: string;
    formData?: Record<string, unknown> | null;
    paymentStatus: string;
    participantName: string;
  };
  event: {
    id: string;
    eventName: string;
    date: string;
    closingTime?: string;
    status: string;
  } | null;
  checkedIn: boolean;
}

export interface CheckInSuccess {
  ticketId: string;
  participantName: string;
  phone?: string;
  event?: { id: string; eventName: string; date: string } | null;
  checkedInAt: string;
  status: string;
}

export const checkinApi = {
  /** Legacy direct check-in (kept for compatibility). */
  checkIn: (ticketId: string) => client.post<CheckInResult>(`/registrations/${ticketId}/check-in`),
  undo: (ticketId: string) => client.delete<CheckInResult>(`/registrations/${ticketId}/check-in`),
  /** Validate a ticket (code, QR token, or ticket URL) without checking in. */
  validate: (ticket: string) => client.post<TicketValidation>('/check-in/validate', { ticket }),
  /** Check in a validated ticket. 409 when already checked in. */
  checkInTicket: (ticket: string) => client.post<CheckInSuccess>('/check-in', { ticket }),
};

/**
 * Friendly organizer-facing message for check-in API failures. Maps backend
 * status codes/messages to fixed strings — raw NestJS errors and stack
 * traces are never shown at the gate.
 */
export function checkinErrorMessage(err: unknown): string {
  const response = (err as { response?: { status?: number; data?: { message?: unknown } } })?.response;
  const status = response?.status;
  const backendMessage = response?.data && typeof response.data === 'object'
    ? (response.data as { message?: unknown }).message
    : undefined;
  const text = typeof backendMessage === 'string' ? backendMessage : '';
  if (status === 404) return 'Ticket not found';
  if (status === 403) return 'This ticket belongs to another event';
  if (status === 409) return 'Ticket already checked in';
  if (/cancel/i.test(text)) return 'This ticket has been cancelled';
  if (/payment|paid/i.test(text)) return 'Payment is not completed';
  return 'Unable to validate ticket. Please try again.';
}

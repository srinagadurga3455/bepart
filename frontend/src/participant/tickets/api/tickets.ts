import client from '../../../app/api/client';
import type { PhoneTicketItem, TicketItem } from '../../../app/types';

export interface MyTicketItem {
  ticket: { code: string; status: string; checkedInAt?: string | null; ticketUrl: string; createdAt: string };
  registration: { registrationId: string; phone: string; paymentStatus: string; createdAt: string };
  event: { id: string; eventName: string; date: string; closingTime?: string; status: string } | null;
}

export const ticketsApi = {
  /**
   * Public ticket lookup by ticket code, QR token, ticket URL, or a legacy
   * registration ID. Unauthenticated — this is what the QR/URL resolves to.
   */
  getTicket: (id: string) => client.get<TicketItem>(`/tickets/${id}`),
  // Public "my tickets" lookup: ALL registrations for a registered mobile
  // number (no OTP, no auth). Reuses GET /registrations/by-phone.
  getTicketsByPhone: (phone: string) =>
    client.get<PhoneTicketItem[]>(`/registrations/by-phone`, { params: { phone } }),
  /** The authenticated student's own tickets. */
  mine: () => client.get<MyTicketItem[]>('/tickets/my'),
};

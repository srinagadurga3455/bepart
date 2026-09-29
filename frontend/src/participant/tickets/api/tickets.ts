import client from '../../../app/api/client';
import type { TicketItem } from '../../../app/types';

export const ticketsApi = {
  getTicket: (id: string) => client.get<TicketItem>(`/registrations/ticket/${id}`),
  // Public "my tickets" lookup: ALL registrations for a registered mobile
  // number (no OTP, no auth). Reuses GET /registrations/by-phone.
  getTicketsByPhone: (phone: string) =>
    client.get<TicketItem[]>(`/registrations/by-phone`, { params: { phone } }),
};

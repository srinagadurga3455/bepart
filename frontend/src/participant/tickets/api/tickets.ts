import client from '../../../app/api/client';
import type { TicketItem } from '../../../app/types';

export const ticketsApi = {
  getTicket: (id: string) => client.get<TicketItem>(`/registrations/ticket/${id}`),
};

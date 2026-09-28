import client from '../../../app/api/client';
import type { CheckInResult } from '../../../app/types';

export const checkinApi = {
  checkIn: (ticketId: string) => client.post<CheckInResult>(`/registrations/${ticketId}/check-in`),
  undo: (ticketId: string) => client.delete<CheckInResult>(`/registrations/${ticketId}/check-in`),
};

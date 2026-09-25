import client from '../../../app/api/client';
import type {
  EventListResponse,
  OrganizerItem,
  OrganizerPayload,
  OrganizerUpdatePayload,
} from '../../../app/types';

export const organizersApi = {
  create: (data: OrganizerPayload) => client.post<OrganizerItem>('/organizers', data),
  list: () => client.get<OrganizerItem[]>('/organizers'),
  get: (id: string) => client.get<OrganizerItem>(`/organizers/${id}`),
  events: (id: string, params?: { page?: number; limit?: number }) =>
    client.get<EventListResponse>(`/organizers/${id}/events`, { params }),
  update: (id: string, data: OrganizerUpdatePayload) =>
    client.patch<OrganizerItem>(`/organizers/${id}`, data),
  remove: (id: string) => client.delete<{ message: string; id: string }>(`/organizers/${id}`),
  deactivate: (id: string) => client.patch<OrganizerItem>(`/organizers/${id}/deactivate`),
  approve: (id: string) => client.patch<OrganizerItem>(`/organizers/${id}/approve`),
};

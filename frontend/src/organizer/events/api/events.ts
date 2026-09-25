import client from '../../../app/api/client';
import type {
  EventItem,
  EventListResponse,
  EventPayload,
  EventQueryParams,
} from '../../../app/types';

export const eventsApi = {
  create: (data: EventPayload) => client.post<EventItem>('/events', data),
  listMy: (params?: EventQueryParams) =>
    client.get<EventListResponse>('/events/my', { params }),
  get: (id: number | string) => client.get<EventItem>(`/events/${id}`),
  update: (id: number | string, data: Partial<EventPayload>) =>
    client.patch<EventItem>(`/events/${id}`, data),
  preview: (id: number | string) => client.post<EventItem>(`/events/${id}/preview`),
  publish: (id: number | string) => client.post<EventItem>(`/events/${id}/publish`),
  cancel: (id: number | string) => client.post<EventItem>(`/events/${id}/cancel`),
  uploadPoster: (id: number | string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<EventItem>(`/events/${id}/poster`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

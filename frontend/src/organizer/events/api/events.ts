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
  // Event artwork uploads (backend validates aspect ratio + ownership):
  // - rectangle (16:9 banner) and square (1:1 card) posters via R2 storage.
  uploadPosterRectangle: (id: number | string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<{ message: string; posterRectangleUrl: string }>(`/storage/events/${id}/poster-rectangle`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  uploadPosterSquare: (id: number | string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return client.post<{ message: string; posterSquareUrl: string }>(`/storage/events/${id}/poster-square`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

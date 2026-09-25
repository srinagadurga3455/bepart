import client from '../../../app/api/client';
import type {
  EventItem,
  EventListResponse,
  EventQueryParams,
  FormStructure,
} from '../../../app/types';

export const eventsApi = {
  listPublished: (params?: EventQueryParams) =>
    client.get<EventListResponse>('/events/public', { params }),
  getPublic: (id: number | string) => client.get<EventItem>(`/events/public/${id}`),
  getRegistrationForm: (id: number | string) =>
    client.get<FormStructure>(`/events/public/${id}/registration-form`),
};

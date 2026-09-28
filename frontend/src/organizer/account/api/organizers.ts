import client from '../../../app/api/client';
import type { OrganizerItem, OrganizerUpdatePayload } from '../../../app/types';

export const organizersApi = {
  getMe: () => client.get<OrganizerItem>('/organizers/me'),
  updateMe: (data: OrganizerUpdatePayload) => client.patch<OrganizerItem>('/organizers/me', data),
};

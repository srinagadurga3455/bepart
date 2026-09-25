import client from '../../../app/api/client';
import type { OrganizerItem } from '../../../app/types';

export const organizersApi = {
  getMe: () => client.get<OrganizerItem>('/organizers/me'),
};

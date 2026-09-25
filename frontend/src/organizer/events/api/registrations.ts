import client from '../../../app/api/client';
import type { RegistrationListResponse } from '../../../app/types';

export const registrationsApi = {
  list: () => client.get<RegistrationListResponse>('/registrations'),
};

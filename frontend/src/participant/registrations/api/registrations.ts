import client from '../../../app/api/client';
import type { RegistrationItem, RegistrationPayload } from '../../../app/types';

export const registrationsApi = {
  create: (data: RegistrationPayload) =>
    client.post<RegistrationItem>('/registrations', data),
  get: (id: string) => client.get<RegistrationItem>(`/registrations/${id}`),
  cancel: (id: string) =>
    client.post<{ message: string; registrationId: string }>(`/registrations/${id}/cancel`),
};

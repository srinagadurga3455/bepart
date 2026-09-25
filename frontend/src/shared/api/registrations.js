import client from './client';

export const registrationsApi = {
  create: (data) => client.post('/registrations', data),
  list: () => client.get('/registrations'),
  get: (id) => client.get(`/registrations/${id}`),
  cancel: (id) => client.post(`/registrations/${id}/cancel`),
  getTicket: (id) => client.get(`/registrations/ticket/${id}`),
};
import client from './client';

export const organizersApi = {
  create: (data) => client.post('/organizers', data),
  getMe: () => client.get('/organizers/me'),
  list: () => client.get('/organizers'),
  get: (id) => client.get(`/organizers/${id}`),
  events: (id, params) => client.get(`/organizers/${id}/events`, { params }),
  update: (id, data) => client.patch(`/organizers/${id}`, data),
  remove: (id) => client.delete(`/organizers/${id}`),
  deactivate: (id) => client.patch(`/organizers/${id}/deactivate`),
  approve: (id) => client.patch(`/organizers/${id}/approve`),
};
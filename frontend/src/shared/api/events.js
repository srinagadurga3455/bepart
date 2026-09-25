import client from './client';

export const eventsApi = {
  create: (data) => client.post('/events', data),
  listPublished: (params) => client.get('/events/public', { params }),
  listMy: (params) => client.get('/events/my', { params }),
  getPublic: (id) => client.get(`/events/public/${id}`),
  get: (id) => client.get(`/events/${id}`),
  update: (id, data) => client.patch(`/events/${id}`, data),
  preview: (id) => client.post(`/events/${id}/preview`),
  publish: (id) => client.post(`/events/${id}/publish`),
  cancel: (id) => client.post(`/events/${id}/cancel`),
  getRegistrationForm: (id) => client.get(`/events/public/${id}/registration-form`),
  uploadPoster: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return client.post(`/events/${id}/poster`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
};
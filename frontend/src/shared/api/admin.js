import client from './client';

export const adminApi = {
  createAdmin: (data) => client.post('/admin/admins', data),
  dashboard: () => client.get('/admin/dashboard'),
  users: () => client.get('/admin/users'),
  events: () => client.get('/admin/events'),
};
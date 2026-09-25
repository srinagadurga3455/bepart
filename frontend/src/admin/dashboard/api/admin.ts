import client from '../../../app/api/client';
import type {
  AdminDashboardData,
  AdminPayload,
  EventItem,
  UserItem,
} from '../../../app/types';

export const adminApi = {
  createAdmin: (data: AdminPayload) => client.post<UserItem>('/admin/admins', data),
  dashboard: () => client.get<AdminDashboardData>('/admin/dashboard'),
  users: () => client.get<UserItem[]>('/admin/users'),
  events: () => client.get<EventItem[]>('/admin/events'),
};

import client from '../../app/api/client';
import type { AuthResponse, UserItem } from '../../app/types';

// Accepts an email address or a phone number (organizers sign in with the
// phone number registered by the admin). The backend looks up either form.
function toIdentifierBody(identifier: string): { email: string } | { phone: string } {
  const clean = identifier.trim();
  if (clean.includes('@')) return { email: clean.toLowerCase() };
  return { phone: clean };
}

export function isEmailIdentifier(identifier: string): boolean {
  return identifier.trim().includes('@');
}

export const authApi = {
  login: (email: string, password: string) =>
    client.post<AuthResponse>('/auth/login', { email, password }),
  requestOtp: (identifier: string) =>
    client.post<{ message: string; expiresAt: string }>('/auth/request-otp', toIdentifierBody(identifier)),
  verifyOtp: (identifier: string, otp: string) =>
    client.post<AuthResponse>('/auth/verify-otp', { ...toIdentifierBody(identifier), otp }),
  me: () => client.get<UserItem>('/auth/me'),
  refresh: (refreshToken: string) =>
    client.post<{ accessToken: string }>('/auth/refresh', { refreshToken }),
};

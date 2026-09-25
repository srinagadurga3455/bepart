import client from './client';

// Accepts an email address or a phone number (organizers sign in with the
// phone number registered by the admin). The backend looks up either form.
function toIdentifierBody(identifier) {
  const clean = String(identifier || '').trim();
  if (clean.includes('@')) return { email: clean.toLowerCase() };
  return { phone: clean };
}

export function isEmailIdentifier(identifier) {
  return String(identifier || '').trim().includes('@');
}

export const authApi = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  requestOtp: (identifier) => client.post('/auth/request-otp', toIdentifierBody(identifier)),
  verifyOtp: (identifier, otp) => client.post('/auth/verify-otp', { ...toIdentifierBody(identifier), otp }),
  me: () => client.get('/auth/me'),
  refresh: (refreshToken) => client.post('/auth/refresh', { refreshToken }),
};
import axios, { type AxiosResponse } from 'axios';

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(
            `${import.meta.env.VITE_API_BASE_URL}/auth/refresh`,
            { refreshToken }
          );
          const { accessToken } = response.data;
          localStorage.setItem('accessToken', accessToken);
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return client(originalRequest);
        }
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Backend lists are returned either as a bare array or as a paginated
 * envelope `{ data, meta }`. This unwraps both shapes without changing
 * any request behavior.
 */
export function unwrapList<T>(response: AxiosResponse | { data?: unknown } | undefined): T[] {
  const body: unknown = response?.data;
  if (Array.isArray(body)) return body as T[];
  if (typeof body === 'object' && body !== null && 'data' in body) {
    const nested: unknown = (body as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

/** Human-readable message from an Axios failure, with a caller fallback. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message: unknown = err.response?.data && typeof err.response.data === 'object'
      ? (err.response.data as { message?: unknown }).message
      : undefined;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default client;

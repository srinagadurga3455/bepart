import axios, { type AxiosResponse } from 'axios';

/**
 * Resolve the API base URL.
 *
 * - Uses VITE_API_BASE_URL when set.
 * - When the page is opened via a LAN IP (e.g. phone testing on the same
 *   Wi-Fi) but the env URL points at localhost (or a stale LAN IP), swap the
 *   hostname to the page's hostname so the request doesn't time out with
 *   ERR_CONNECTION_TIMED_OUT. Port and /api path are preserved.
 * - Falls back to localhost for local dev.
 */
function resolveBaseURL(): string {
  const configured =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

  try {
    if (typeof window !== 'undefined' && window.location?.hostname) {
      const pageHost = window.location.hostname;
      const url = new URL(configured);
      const isPageLan =
        pageHost !== 'localhost' && pageHost !== '127.0.0.1';
      const isConfiguredLocal =
        url.hostname === 'localhost' || url.hostname === '127.0.0.1';
      if (isPageLan && (isConfiguredLocal || url.hostname !== pageHost)) {
        url.hostname = pageHost;
        return url.toString().replace(/\/$/, '');
      }
    }
  } catch {
    // If URL parsing fails, use the configured value as-is.
  }
  return configured;
}

const baseURL = resolveBaseURL();

if (!import.meta.env.VITE_API_BASE_URL && import.meta.env.DEV) {
  console.warn(
    '[api] VITE_API_BASE_URL is missing (frontend/.env). Falling back to http://localhost:3000/api. ' +
      'Create frontend/.env with VITE_API_BASE_URL=http://localhost:3000/api and restart Vite.'
  );
}

const client = axios.create({
  baseURL,
  timeout: 10000,
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
            `${baseURL}/auth/refresh`,
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
    // Backend unreachable (server down, wrong IP, firewall, changed Wi-Fi):
    // axios has no response. Surface a clear message instead of a timeout.
    if (!err.response) {
      if (err.code === 'ECONNABORTED') {
        return `Backend did not respond at ${baseURL} (timeout). Is the server running?`;
      }
      return `Cannot reach backend at ${baseURL}. Is the server running and reachable?`;
    }
    const message: unknown = err.response?.data && typeof err.response.data === 'object'
      ? (err.response.data as { message?: unknown }).message
      : undefined;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

export default client;

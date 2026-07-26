const TOKEN_KEY = 'asahi_token';

/**
 * The auth token is kept per TAB, not per browser.
 *
 * localStorage is shared by every tab of an origin, so signing in as an admin
 * in one tab overwrote the staff token in another. Worse than logging the first
 * tab out: it kept displaying the staff UI (the user is read once on mount) while
 * its requests carried the admin token and came back 403. sessionStorage is
 * scoped to the tab, so a staff view and an admin view can sit side by side.
 *
 * The trade-off is that the token dies with the tab — a reload keeps it, a new
 * tab starts signed out. For stadium shifts and demos that is the right side of
 * the trade, and it keeps a bearer token from living indefinitely on a shared
 * machine. Language stays in localStorage: it's a preference, not a credential.
 */
export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string | null): void {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}

// Tokens written by earlier builds outlive the browser session. Clear any
// leftover so an old one isn't left sitting in localStorage forever.
try {
  localStorage.removeItem(TOKEN_KEY);
} catch {
  // Storage can be blocked entirely (private mode, cookies disabled).
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: (path: string) => request<void>('DELETE', path),
};

/** Raw authenticated fetch, for non-JSON responses (HTML / PDF documents). */
export function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(options.headers as Record<string, string>) };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(path, { ...options, headers });
}

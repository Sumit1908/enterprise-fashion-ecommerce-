'use client';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'sj_admin_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

/**
 * Upload a file via multipart/form-data to an authenticated endpoint.
 * `onProgress` (0–100) fires as the bytes leave the browser.
 */
export function apiUpload<T>(
  path: string,
  file: File,
  opts: { field?: string; onProgress?: (pct: number) => void; signal?: AbortSignal } = {},
): Promise<T> {
  const token = getToken();
  const { field = 'file', onProgress, signal } = opts;
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/api/v1${path}`);
    if (token) xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { message?: string } = {};
      try {
        body = JSON.parse(xhr.responseText) as { message?: string };
      } catch {
        /* non-JSON body */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body as T);
      } else if (xhr.status === 401) {
        clearToken();
        if (typeof window !== 'undefined') window.location.href = '/login';
        reject(new Error('Session expired'));
      } else {
        reject(new Error(body.message ?? `Upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    const form = new FormData();
    form.append(field, file);
    xhr.send(form);
  });
}

/** Best-effort DELETE with a JSON body (auth handled by apiFetch). */
export async function apiDelete(path: string, body?: unknown): Promise<void> {
  await apiFetch(path, {
    method: 'DELETE',
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Fetch a file from an authenticated endpoint and trigger a browser download. */
export async function apiDownload(path: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`Download failed (${res.status})`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export interface AdminMe {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  kind: string;
  isSuperAdmin: boolean;
  roles: string[];
}

/** The signed-in user, or null when the token is missing / not a staff account. */
export async function fetchMe(): Promise<AdminMe | null> {
  if (!getToken()) return null;
  try {
    const me = await apiFetch<AdminMe>('/auth/me');
    const isStaff = me.isSuperAdmin || me.kind === 'STAFF' || (me.roles?.length ?? 0) > 0;
    return isStaff ? me : null;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new Error(body.message ?? 'Login failed');
  }
  const data = (await res.json()) as { accessToken: string };
  setToken(data.accessToken);

  // Only staff / admins may hold an admin session.
  const me = await fetchMe();
  if (!me) {
    clearToken();
    throw new Error('This account does not have admin access.');
  }
}

export function money(value: string | number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(value));
}

import type { ApiResponse, PageMeta } from '@acuheal/types';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
  /** Field-level errors from a zod validation failure, keyed by field path. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as { path?: string; message?: string }[]) {
        if (d.path) out[d.path] = d.message ?? 'Invalid value';
      }
    }
    return out;
  }
}

let accessToken: string | null = null;
let activeBranchId: string | null = null;
let onUnauthorized: (() => void) | null = null;

export const auth = {
  setToken(token: string | null) {
    accessToken = token;
  },
  getToken: () => accessToken,
  setBranch(id: string | null) {
    activeBranchId = id;
  },
  getBranch: () => activeBranchId,
  onUnauthorized(fn: (() => void) | null) {
    onUnauthorized = fn;
  },
};

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** send cookies (refresh flow) */
  credentials?: RequestCredentials;
  signal?: AbortSignal;
  /** skip the automatic refresh-and-retry (used by the refresh call itself) */
  noRetry?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_URL}${path.startsWith('/') ? path : `/${path}`}`);
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  }
  return url.toString();
}

let refreshing: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(buildUrl('/auth/refresh'), { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const json = (await res.json()) as ApiResponse<{ accessToken: string }>;
      if (!json.success) return false;
      accessToken = json.data.accessToken;
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => (refreshing = null), 0);
    }
  })();
  return refreshing;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<{ data: T; meta?: PageMeta }> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (activeBranchId) headers['x-branch-id'] = activeBranchId;
  if (opts.body !== undefined && !(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    credentials: opts.credentials ?? 'include',
    signal: opts.signal,
    body: opts.body === undefined ? undefined : opts.body instanceof FormData ? opts.body : JSON.stringify(opts.body),
  });

  if (res.status === 401 && !opts.noRetry) {
    if (await refreshToken()) return request<T>(path, { ...opts, noRetry: true });
    onUnauthorized?.();
  }

  const text = await res.text();
  const json = text ? (JSON.parse(text) as ApiResponse<T>) : ({ success: false, error: { code: 'EMPTY', message: 'Empty response' } } as ApiResponse<T>);
  if (!res.ok || !json.success) {
    const err = json.success ? { code: 'HTTP', message: res.statusText } : json.error;
    throw new ApiError(res.status, err.code, err.message, 'details' in err ? err.details : undefined);
  }
  return { data: json.data, meta: json.meta };
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown, query?: RequestOptions['query']) => request<T>(path, { method: 'POST', body, query }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  refresh: refreshToken,
};

/** Downloads a CSV export through the authenticated API. */
export async function downloadCsv(path: string, query: RequestOptions['query'], filename: string): Promise<void> {
  const headers: Record<string, string> = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  if (activeBranchId) headers['x-branch-id'] = activeBranchId;
  const res = await fetch(buildUrl(path, query), { headers, credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, 'EXPORT', 'Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

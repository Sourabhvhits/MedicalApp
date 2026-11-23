import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import type { ApiErrorBody, ApiResponse, AuthTokens, PaginatedResponse } from './types';

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000/api/v1';

const ACCESS_TOKEN_KEY = 'medsaas.accessToken';
const REFRESH_TOKEN_KEY = 'medsaas.refreshToken';

export const tokenStore = {
  get access(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(ACCESS_TOKEN_KEY);
  },
  get refresh(): string | null {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  set(tokens: AuthTokens): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
    window.localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
  },
  clear(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

/** Normalised error the UI can render directly. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiErrorBody['details'];

  constructor(status: number, body: Partial<ApiErrorBody>) {
    super(body.message ?? 'Something went wrong');
    this.status = status;
    this.code = body.code ?? 'ERROR';
    this.details = body.details;
  }

  /** Field-keyed messages for Formik's setFieldError. */
  get fieldErrors(): Record<string, string> {
    return (this.details ?? []).reduce<Record<string, string>>((acc, detail) => {
      if (detail.field) acc[detail.field] = detail.message;
      return acc;
    }, {});
  }
}

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 30_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Callback invoked when the session can no longer be recovered. */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

// A single in-flight refresh shared by every queued request.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;

  try {
    const { data } = await axios.post<ApiResponse<{ tokens: AuthTokens }>>(
      `${API_BASE_URL}/auth/refresh`,
      { refreshToken },
      { withCredentials: true },
    );
    tokenStore.set(data.data.tokens);
    return data.data.tokens.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    const status = error.response?.status ?? 0;

    // One transparent refresh + replay per request.
    const isAuthCall = original?.url?.includes('/auth/');
    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });

      const token = await refreshPromise;
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }

      onSessionExpired?.();
    }

    if (!error.response) {
      throw new ApiError(0, {
        message: 'Cannot reach the server. Check your connection and try again.',
        code: 'NETWORK_ERROR',
      });
    }

    throw new ApiError(status, error.response.data ?? {});
  },
);

type Query = Record<string, string | number | boolean | undefined | null>;

/** Strips empty values so blank filters never reach the API. */
function cleanParams(params?: Query): Query | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  );
}

export async function getOne<T>(url: string, params?: Query): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(url, { params: cleanParams(params) });
  return data.data;
}

export async function getList<T>(url: string, params?: Query): Promise<PaginatedResponse<T>> {
  const { data } = await api.get<PaginatedResponse<T>>(url, { params: cleanParams(params) });
  return data;
}

export async function post<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.post<ApiResponse<T>>(url, body);
  return data.data;
}

export async function put<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.put<ApiResponse<T>>(url, body);
  return data.data;
}

export async function patch<T>(url: string, body?: unknown): Promise<T> {
  const { data } = await api.patch<ApiResponse<T>>(url, body);
  return data.data;
}

export async function del<T>(url: string): Promise<T> {
  const { data } = await api.delete<ApiResponse<T>>(url);
  return data.data;
}

export async function upload<T>(url: string, formData: FormData): Promise<T> {
  const { data } = await api.post<ApiResponse<T>>(url, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data.data;
}

/** Downloads an export, preserving the filename the server suggests. */
export async function download(url: string, params: Query, fallbackName: string): Promise<void> {
  const response = await api.get<Blob>(url, {
    params: cleanParams(params),
    responseType: 'blob',
  });

  const disposition = response.headers['content-disposition'] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const objectUrl = window.URL.createObjectURL(response.data);

  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = match?.[1] ?? fallbackName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(objectUrl);
}

import { ApiError } from "./errors";
import type { ProblemDetail } from "./types";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  setTokens,
} from "@/lib/auth/tokens";
import { getImpersonatedTenantId } from "@/lib/auth/impersonation";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8284/api/v1";

/**
 * Called when the session can no longer be recovered (refresh failed/absent on a 401).
 * The auth provider registers a handler here to clear state and route to /login.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  /** JSON-serializable body; set automatically with the right Content-Type. */
  body?: unknown;
  /** Skip the Authorization header (used for login/refresh/public endpoints). */
  auth?: boolean;
  /** Query params appended to the URL (undefined/null values are dropped). */
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(
    path.startsWith("http") ? path : `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let problem: ProblemDetail | undefined;
  try {
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) problem = (await res.json()) as ProblemDetail;
  } catch {
    /* ignore non-JSON error bodies */
  }
  return new ApiError(res.status, problem?.title ?? res.statusText, problem);
}

// ── refresh: single-flight so concurrent 401s share one refresh round-trip ──
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  const res = await fetch(buildUrl("/auth/refresh"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string; refreshToken: string };
  setTokens(data.accessToken, data.refreshToken);
  return true;
}

function ensureRefreshed(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function doFetch(path: string, options: RequestOptions, withAuth: boolean): Promise<Response> {
  const headers = new Headers(options.headers);
  if (options.body !== undefined && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (withAuth) {
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    // SUPER_ADMIN impersonation: operate within the chosen school (ignored by the backend for
    // tenant-scoped users, who carry their tenant in the JWT).
    const impersonated = getImpersonatedTenantId();
    if (impersonated != null) headers.set("X-Tenant-Id", String(impersonated));
  }
  return fetch(buildUrl(path, options.query), {
    ...options,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

/** Core request: attaches the JWT, transparently refreshes once on 401, parses problem+json. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const withAuth = options.auth !== false;

  let res = await doFetch(path, options, withAuth);

  if (res.status === 401 && withAuth) {
    const refreshed = await ensureRefreshed();
    if (refreshed) {
      res = await doFetch(path, options, withAuth);
    } else {
      clearTokens();
      onSessionExpired?.();
      throw await parseError(res);
    }
  }

  if (!res.ok) throw await parseError(res);

  if (res.status === 204) return undefined as T;
  const ct = res.headers.get("content-type") ?? "";
  if (!ct.includes("json")) return undefined as T;
  return (await res.json()) as T;
}

/**
 * Fetches a binary endpoint (e.g. application/pdf) WITH the JWT, and returns a local object URL
 * usable directly in an <iframe>/<img>. Avoids depending on third-party delivery (Cloudinary) and
 * works around iframes not carrying the Authorization header.
 */
export async function apiBlobUrl(path: string, options: RequestOptions = {}): Promise<string> {
  const withAuth = options.auth !== false;
  let res = await doFetch(path, { ...options, method: "GET" }, withAuth);
  if (res.status === 401 && withAuth) {
    const refreshed = await ensureRefreshed();
    if (refreshed) res = await doFetch(path, { ...options, method: "GET" }, withAuth);
    else { clearTokens(); onSessionExpired?.(); throw await parseError(res); }
  }
  if (!res.ok) throw await parseError(res);
  return URL.createObjectURL(await res.blob());
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  blobUrl: (path: string, options?: RequestOptions) => apiBlobUrl(path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};

import axios, { type AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import { ApiError } from "./errors";
import type { ProblemDetail } from "./types";
import { clearTokens, getAccessToken, getRefreshToken, setTokens } from "@/lib/auth/tokens";
import { getImpersonatedTenantId } from "@/lib/auth/impersonation";
import { useNetworkStore } from "@/lib/offline/network-store";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8284/api/v1";

/**
 * Called when the session can no longer be recovered (refresh failed/absent on a 401).
 * The auth provider registers a handler here to clear state and route to /login.
 */
let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(handler: (() => void) | null): void {
  onSessionExpired = handler;
}

export interface RequestOptions {
  /** JSON-serializable body; set automatically with the right Content-Type. */
  body?: unknown;
  /** Skip the Authorization header (used for login/refresh/public endpoints). */
  auth?: boolean;
  /** Query params appended to the URL (undefined/null values are dropped). */
  query?: Record<string, string | number | boolean | undefined | null>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

declare module "axios" {
  interface AxiosRequestConfig {
    /** Mirrors RequestOptions.auth — read by the request/response interceptors below. Named
     *  `requireAuth` (not `auth`) because axios already reserves `auth` for HTTP basic credentials. */
    requireAuth?: boolean;
    /** Set once a request has already been retried after a token refresh (prevents retry loops). */
    _retried?: boolean;
  }
}

// Sans `timeout`, axios attend indéfiniment (0 = pas de limite) : sur un réseau mobile instable
// (§retour comptable — "ça ne fait que tourner, rien ne se passe" en inscrivant un élève), une requête
// qui ne reçoit jamais de réponse laisse le bouton en chargement pour toujours, sans erreur ni retour
// possible. 30s laisse une marge large pour un traitement serveur lent (ex. génération groupée de
// plusieurs factures à l'inscription) tout en garantissant qu'un échec silencieux finisse par échouer
// PROPREMENT (ApiError status=0, déjà traité comme hors-ligne par isNetworkError — voir toApiError).
const REQUEST_TIMEOUT_MS = 30_000;

const http = axios.create({ baseURL: BASE_URL, timeout: REQUEST_TIMEOUT_MS });

http.interceptors.request.use((config) => {
  const withAuth = config.requireAuth !== false;
  if (withAuth) {
    const token = getAccessToken();
    if (token) config.headers.set("Authorization", `Bearer ${token}`);
    // SUPER_ADMIN impersonation: operate within the chosen school (ignored by the backend for
    // tenant-scoped users, who carry their tenant in the JWT).
    const impersonated = getImpersonatedTenantId();
    if (impersonated != null) config.headers.set("X-Tenant-Id", String(impersonated));
  }
  return config;
});

// ── refresh: single-flight so concurrent 401s share one refresh round-trip ──
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await axios.post<{ accessToken: string; refreshToken: string }>(
      `${BASE_URL}/auth/refresh`,
      { refreshToken },
      { headers: { "Content-Type": "application/json" }, timeout: REQUEST_TIMEOUT_MS },
    );
    setTokens(res.data.accessToken, res.data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function ensureRefreshed(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

/** Extracts the RFC7807 problem+json body, whether it came back as JSON or as a Blob (PDF endpoints). */
async function toApiError(error: AxiosError): Promise<ApiError> {
  const status = error.response?.status ?? 0;
  const data = error.response?.data;
  let problem: ProblemDetail | undefined;
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    try {
      const text = await data.text();
      problem = text ? (JSON.parse(text) as ProblemDetail) : undefined;
    } catch {
      /* ignore non-JSON error bodies */
    }
  } else if (data && typeof data === "object") {
    problem = data as ProblemDetail;
  }
  // Un dépassement du timeout ci-dessus (ECONNABORTED) renvoie par défaut un message axios technique
  // en anglais ("timeout of 30000ms exceeded") — remplacé par un message clair, cohérent avec les
  // autres erreurs réseau affichées à l'écran.
  const message = error.code === "ECONNABORTED"
    ? "Le serveur met trop de temps à répondre. Vérifiez votre connexion et réessayez."
    : (problem?.title ?? error.message);
  return new ApiError(status, message, problem);
}

http.interceptors.response.use(
  (res) => {
    // Un aller-retour réussi prouve la connectivité — corrige immédiatement un faux "hors-ligne" (ex.
    // navigator.onLine remonté à tort) sans attendre l'événement `online` du navigateur.
    useNetworkStore.getState().setOnline(true);
    return res;
  },
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    const withAuth = config?.requireAuth !== false;

    if (error.response?.status === 401 && withAuth && config) {
      if (!config._retried) {
        const refreshed = await ensureRefreshed();
        if (refreshed) {
          config._retried = true;
          return http(config);
        }
      }
      // Le token a échoué même après rafraîchissement (ou la requête rejouée essuie elle-même un
      // nouveau 401) : sans ce nettoyage, la session reste « zombie » — token mort en localStorage,
      // l'appli paraît connectée mais toute requête échoue silencieusement jusqu'à un F5 manuel
      // (l'utilisateur croit alors avoir perdu ses données/actions).
      clearTokens();
      onSessionExpired?.();
    }
    // Aucune réponse HTTP reçue (offline, DNS/timeout, CORS) : signale l'état hors-ligne — plus réactif
    // que le seul événement `offline` du navigateur (ex. Wi-Fi local up mais backend injoignable).
    if (!error.response) {
      useNetworkStore.getState().setOnline(false);
    }
    return Promise.reject(await toApiError(error));
  },
);

async function request<T>(path: string, method: string, options: RequestOptions): Promise<T> {
  const config: AxiosRequestConfig = {
    method,
    url: path,
    params: options.query,
    data: options.body,
    headers: options.headers,
    requireAuth: options.auth,
    signal: options.signal,
  };
  const res = await http.request<T>(config);
  if (res.status === 204) return undefined as T;
  const contentType = String(res.headers["content-type"] ?? "");
  if (!contentType.includes("json")) return undefined as T;
  return res.data;
}

/** Core request: attaches the JWT, transparently refreshes once on 401, parses problem+json. */
export function apiFetch<T>(path: string, options: RequestOptions & { method?: string } = {}): Promise<T> {
  const { method = "GET", ...rest } = options;
  return request<T>(path, method, rest);
}

/**
 * Fetches a binary endpoint (e.g. application/pdf) WITH the JWT, and returns a local object URL
 * usable directly in an <iframe>/<img>. Avoids depending on third-party delivery (Cloudinary) and
 * works around iframes not carrying the Authorization header.
 */
export async function apiBlobUrl(path: string, options: RequestOptions = {}): Promise<string> {
  const res = await http.request<Blob>({
    method: "GET",
    url: path,
    params: options.query,
    headers: options.headers,
    requireAuth: options.auth,
    signal: options.signal,
    responseType: "blob",
  });
  return URL.createObjectURL(res.data);
}

/** Comme {@link apiBlobUrl}, mais en POST avec un corps JSON — pour un export dont les critères
 * (ex. une liste d'identifiants sélectionnés à l'écran) sont trop volumineux/structurés pour une
 * simple query string. */
export async function apiPostBlobUrl(path: string, body: unknown, options: RequestOptions = {}): Promise<string> {
  const res = await http.request<Blob>({
    method: "POST",
    url: path,
    data: body,
    headers: options.headers,
    requireAuth: options.auth,
    signal: options.signal,
    responseType: "blob",
  });
  return URL.createObjectURL(res.data);
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, "GET", options ?? {}),
  blobUrl: (path: string, options?: RequestOptions) => apiBlobUrl(path, options),
  postBlobUrl: (path: string, body: unknown, options?: RequestOptions) => apiPostBlobUrl(path, body, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "POST", { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "PUT", { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "PATCH", { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, "DELETE", options ?? {}),
};

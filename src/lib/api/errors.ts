import type { ProblemDetail } from "./types";

/** Error thrown by the API client for any non-2xx response. Carries the parsed problem+json body. */
export class ApiError extends Error {
  readonly status: number;
  readonly problem?: ProblemDetail;

  constructor(status: number, message: string, problem?: ProblemDetail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }

  /** A user-facing message: server detail/title if available, otherwise a generic fallback. */
  get userMessage(): string {
    return this.problem?.detail || this.problem?.title || this.message;
  }

  /** Field validation errors keyed by field name, when the server returned any. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const e of this.problem?.errors ?? []) {
      if (e.field) out[e.field] = e.message ?? "Invalide";
    }
    return out;
  }
}

/** True when no HTTP response was ever received (offline, DNS/timeout, CORS) — as opposed to a real
 *  server-side refusal (validation, permission…), which always carries a status. Used to decide
 *  whether a failed write can safely fall back to the offline sync queue (see lib/offline/). */
export function isNetworkError(err: unknown): boolean {
  return err instanceof ApiError && err.status === 0;
}

/** Standard paginated envelope returned by collection endpoints (see CLAUDE.md conventions). */
export interface Page<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

/** RFC 7807 problem+json body returned on errors. */
export interface ProblemDetail {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Field-level validation errors, when present. */
  errors?: Array<{ field?: string; message?: string }>;
}

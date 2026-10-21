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
  /** Code métier optionnel distinguant un 409/403 générique d'un cas précis que l'UI doit traiter
   * différemment (ex. "CAPACITE_ATTEINTE" — propose de forcer plutôt qu'un simple message d'erreur). */
  raison?: string;
  /** Présents uniquement quand raison === "CAPACITE_ATTEINTE" (§6 cahier des charges). */
  classId?: number;
  currentCount?: number;
  maxCapacity?: number;
}

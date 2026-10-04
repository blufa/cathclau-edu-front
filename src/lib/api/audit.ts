import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type { AuditLogEntry } from "@/lib/types/audit";

export interface AuditLogSearchParams {
  action?: string;
  utilisateurId?: number;
  /** ISO-8601 (ex. 2026-10-01T00:00:00). */
  from?: string;
  to?: string;
  page?: number;
  size?: number;
}

export function searchAuditLogs(params: AuditLogSearchParams): Promise<Page<AuditLogEntry>> {
  return api.get<Page<AuditLogEntry>>("/audit-logs", {
    query: {
      action: params.action || undefined,
      utilisateurId: params.utilisateurId,
      from: params.from || undefined,
      to: params.to || undefined,
      page: params.page,
      size: params.size,
    },
  });
}

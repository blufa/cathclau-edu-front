import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type { AuditLogEntry } from "@/lib/types/audit";
import type { AccountantAnomalyAlert } from "@/lib/types/accountant-anomaly";

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

/** Détecteur B3 (§retour fondateurs) : écarts statistiques entre comptables de l'école courante. */
export function listAccountantAnomalyAlerts(): Promise<AccountantAnomalyAlert[]> {
  return api.get<AccountantAnomalyAlert[]>("/accountant-anomaly-alerts");
}

export interface AuditLogActor {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
}

/** Utilisateurs de l'école courante pour le filtre "par utilisateur" du journal d'audit — n'exige que
 * `audit:read` (pas `user:read`, que certains rôles consultant le journal n'ont pas, ex. comptable). */
export function listAuditLogActors(): Promise<AuditLogActor[]> {
  return api.get<AuditLogActor[]>("/audit-logs/actors");
}

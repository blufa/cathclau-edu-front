import { api } from "@/lib/api/client";
import type { DpeAlert, DpeAlertStatus, DpeDashboardOverview, DpeSchoolSummary } from "@/lib/types/dpe";

/** Périmètre résolu côté backend depuis les préfectures/communes affectées au compte DPE_ADMIN
 * connecté — jamais un paramètre côté client (voir DpeDashboardController). */
export function getDpeDashboard(): Promise<DpeDashboardOverview> {
  return api.get<DpeDashboardOverview>("/dpe/dashboard");
}

export function listDpeSchools(): Promise<DpeSchoolSummary[]> {
  return api.get<DpeSchoolSummary[]>("/dpe/schools");
}

export function getDpeSchool(tenantId: number): Promise<DpeSchoolSummary> {
  return api.get<DpeSchoolSummary>(`/dpe/schools/${tenantId}`);
}

export function listDpeAlerts(statut?: DpeAlertStatus): Promise<DpeAlert[]> {
  return api.get<DpeAlert[]>("/dpe/alerts", { query: { statut } });
}

export function updateDpeAlertStatus(id: number, statut: DpeAlertStatus): Promise<DpeAlert> {
  return api.patch<DpeAlert>(`/dpe/alerts/${id}/statut`, { statut });
}

export function refreshDpeAlerts(): Promise<void> {
  return api.post<void>("/dpe/alerts/refresh");
}

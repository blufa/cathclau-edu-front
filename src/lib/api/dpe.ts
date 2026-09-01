import { api } from "@/lib/api/client";
import type { DpeAlert, DpeAlertStatus, DpeDashboardOverview, DpeSchoolSummary } from "@/lib/types/dpe";

/**
 * Périmètre résolu côté backend (jamais recalculé côté client) :
 * - un DPE_ADMIN utilise toujours son propre périmètre — `prefectureId` est ignoré pour ce rôle
 *   par le backend, même s'il est transmis ;
 * - un SUPER_ADMIN doit fournir explicitement `prefectureId` (prévisualisation/support) — voir
 *   le sélecteur de préfecture affiché uniquement pour ce rôle sur les pages /dpe/*.
 */
export function getDpeDashboard(prefectureId?: number): Promise<DpeDashboardOverview> {
  return api.get<DpeDashboardOverview>("/dpe/dashboard", { query: { prefectureId } });
}

export function listDpeSchools(prefectureId?: number): Promise<DpeSchoolSummary[]> {
  return api.get<DpeSchoolSummary[]>("/dpe/schools", { query: { prefectureId } });
}

export function getDpeSchool(tenantId: number, prefectureId?: number): Promise<DpeSchoolSummary> {
  return api.get<DpeSchoolSummary>(`/dpe/schools/${tenantId}`, { query: { prefectureId } });
}

export function listDpeAlerts(statut?: DpeAlertStatus, prefectureId?: number): Promise<DpeAlert[]> {
  return api.get<DpeAlert[]>("/dpe/alerts", { query: { statut, prefectureId } });
}

export function updateDpeAlertStatus(id: number, statut: DpeAlertStatus, prefectureId?: number): Promise<DpeAlert> {
  return api.patch<DpeAlert>(`/dpe/alerts/${id}/statut`, { statut }, { query: { prefectureId } });
}

export function refreshDpeAlerts(prefectureId?: number): Promise<void> {
  return api.post<void>("/dpe/alerts/refresh", undefined, { query: { prefectureId } });
}

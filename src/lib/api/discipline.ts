import { api } from "@/lib/api/client";
import type { DisciplineIncident, DisciplineInput, DisciplineStatus } from "@/lib/types/discipline";

export function listIncidents(params?: { studentId?: number; status?: DisciplineStatus }): Promise<DisciplineIncident[]> {
  return api.get<DisciplineIncident[]>("/discipline", { query: { studentId: params?.studentId, status: params?.status } });
}

export function createIncident(input: DisciplineInput): Promise<DisciplineIncident> {
  return api.post<DisciplineIncident>("/discipline", input);
}

export function updateIncident(id: number, input: DisciplineInput): Promise<DisciplineIncident> {
  return api.put<DisciplineIncident>(`/discipline/${id}`, input);
}

export function resolveIncident(id: number): Promise<DisciplineIncident> {
  return api.patch<DisciplineIncident>(`/discipline/${id}/resolve`);
}

export function dismissIncident(id: number): Promise<DisciplineIncident> {
  return api.patch<DisciplineIncident>(`/discipline/${id}/dismiss`);
}

export function markIncidentNotified(id: number): Promise<DisciplineIncident> {
  return api.patch<DisciplineIncident>(`/discipline/${id}/notified`);
}

export function deleteIncident(id: number): Promise<void> {
  return api.delete<void>(`/discipline/${id}`);
}

import { api } from "@/lib/api/client";
import type { HealthRecord, HealthRecordInput, InfirmaryVisit, VisitInput } from "@/lib/types/health";

// ── Fiche santé ────────────────────────────────────────────────────────────────
export function getHealthRecord(studentId: number): Promise<HealthRecord | null> {
  return api.get<HealthRecord>(`/health/records/student/${studentId}`).catch(() => null);
}

export function upsertHealthRecord(studentId: number, input: HealthRecordInput): Promise<HealthRecord> {
  return api.put<HealthRecord>(`/health/records/student/${studentId}`, input);
}

// ── Passages à l'infirmerie ─────────────────────────────────────────────────────
export function listVisits(studentId?: number): Promise<InfirmaryVisit[]> {
  return api.get<InfirmaryVisit[]>("/health/visits", { query: { studentId } });
}

export function recordVisit(input: VisitInput): Promise<InfirmaryVisit> {
  return api.post<InfirmaryVisit>("/health/visits", input);
}

export function updateVisit(id: number, input: VisitInput): Promise<InfirmaryVisit> {
  return api.put<InfirmaryVisit>(`/health/visits/${id}`, input);
}

export function notifyVisitParent(id: number): Promise<InfirmaryVisit> {
  return api.patch<InfirmaryVisit>(`/health/visits/${id}/notify-parent`);
}

export function deleteVisit(id: number): Promise<void> {
  return api.delete<void>(`/health/visits/${id}`);
}

import { api } from "@/lib/api/client";
import type { BadgeKind, CardOrientation, CardTemplate, StudentCard } from "@/lib/types/student-card";

// ── Templates ────────────────────────────────────────────────────────────────
export function listCardTemplates(badgeKind?: BadgeKind): Promise<CardTemplate[]> {
  return api.get<CardTemplate[]>("/cartes/modeles", { query: { badgeKind } });
}
export function createCardTemplate(input: {
  name: string; logoUrl?: string | null; primaryColor?: string | null; secondaryColor?: string | null;
  backgroundUrl?: string | null; orientation?: CardOrientation | null; rectoConfig?: string | null;
  versoConfig?: string | null; active?: boolean; badgeKind?: BadgeKind;
}): Promise<CardTemplate> {
  return api.post<CardTemplate>("/cartes/modeles", input);
}
export function updateCardTemplate(id: number, input: Record<string, unknown>): Promise<CardTemplate> {
  return api.put<CardTemplate>(`/cartes/modeles/${id}`, input);
}
export function setDefaultCardTemplate(id: number): Promise<CardTemplate> {
  return api.patch<CardTemplate>(`/cartes/modeles/${id}/definir-defaut`);
}
export function deleteCardTemplate(id: number): Promise<void> {
  return api.delete<void>(`/cartes/modeles/${id}`);
}

// ── Cards ────────────────────────────────────────────────────────────────────
export function listCards(): Promise<StudentCard[]> {
  return api.get<StudentCard[]>("/cartes");
}
export function getStudentCard(studentId: number): Promise<StudentCard> {
  return api.get<StudentCard>(`/eleves/${studentId}/carte`);
}
export function issueStudentCard(studentId: number, input: {
  cardTemplateId?: number | null; academicYearId?: number | null; classId?: number | null;
  studentNumber?: string | null; photoUrl?: string | null; expirationDate?: string | null;
}): Promise<StudentCard> {
  return api.post<StudentCard>(`/eleves/${studentId}/carte`, input);
}
export function replaceCard(id: number): Promise<StudentCard> {
  return api.patch<StudentCard>(`/cartes/${id}/remplacer`);
}
export function declareCardLost(id: number): Promise<StudentCard> {
  return api.patch<StudentCard>(`/cartes/${id}/declarer-perdue`);
}

/** Vérifie l'authenticité d'une carte scannée (payload + signature du QR code). */
export function verifyCard(payload: string, signature: string): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>("/cartes/verifier", { query: { payload, signature } });
}

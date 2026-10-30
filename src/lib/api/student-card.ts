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
/** Émet si aucune carte active n'existe, la régénère automatiquement si le matricule/la photo/la
 * classe soumis diffère de la carte active (ex. matricule modifié depuis l'émission), sinon renvoie
 * celle-ci inchangée — toujours à jour, contrairement à un simple GET suivi d'un POST conditionnel. */
export function getOrRefreshStudentCard(studentId: number, input: {
  cardTemplateId?: number | null; academicYearId?: number | null; classId?: number | null;
  studentNumber?: string | null; photoUrl?: string | null; expirationDate?: string | null;
}): Promise<StudentCard> {
  return api.post<StudentCard>(`/eleves/${studentId}/carte/actuelle`, input);
}
export function replaceCard(id: number): Promise<StudentCard> {
  return api.patch<StudentCard>(`/cartes/${id}/remplacer`);
}
export function declareCardLost(id: number): Promise<StudentCard> {
  return api.patch<StudentCard>(`/cartes/${id}/declarer-perdue`);
}
/** Suppression définitive (§retour utilisateur : "je remets le badge, il prend toujours l'ancien
 * matricule") — sans aucune carte ACTIVE restante pour l'élève, la prochaine émission repart à neuf
 * avec le matricule/la photo/la classe à jour, au lieu de la détection automatique de
 * getOrRefreshStudentCard qui ne couvre pas tous les cas. */
export function deleteStudentCard(id: number): Promise<void> {
  return api.delete<void>(`/cartes/${id}`);
}

/** Marque ces cartes comme imprimées (après passage sur une planche de badges) — pour filtrer ensuite
 * les cartes restant à imprimer et ne jamais réimprimer par erreur un badge déjà sorti. */
export function markCardsPrinted(ids: number[]): Promise<StudentCard[]> {
  return api.patch<StudentCard[]>("/cartes/marquer-imprimees", { ids });
}

/** Vérifie l'authenticité d'une carte scannée (payload + signature du QR code). */
export function verifyCard(payload: string, signature: string): Promise<Record<string, unknown>> {
  return api.get<Record<string, unknown>>("/cartes/verifier", { query: { payload, signature } });
}

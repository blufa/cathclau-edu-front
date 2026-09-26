import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type { Parent, Student } from "@/lib/types/student";

export type Relationship = "FATHER" | "MOTHER" | "GUARDIAN" | "TUTRICE" | "TANTE" | "ONCLE" | "FRERE" | "SOEUR";

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  FATHER: "Père",
  MOTHER: "Mère",
  GUARDIAN: "Tuteur",
  TUTRICE: "Tutrice",
  TANTE: "Tante",
  ONCLE: "Oncle",
  FRERE: "Frère",
  SOEUR: "Sœur",
};

export interface ParentInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  occupation?: string | null;
  address?: string | null;
  /** Clé d'idempotence (mode hors-ligne, lib/offline/) : rejouer avec la même clé après une coupure
   * réseau renvoie le parent déjà créé côté serveur au lieu d'en créer un second. */
  idempotencyKey?: string;
}

/** La fiche parent de l'utilisateur connecté (portail parent). */
export function getMyParent(): Promise<Parent> {
  return api.get<Parent>("/parents/me");
}

/** Un parent minimal (identité + contact), tel que renvoyé pour la présélection de destinataires. */
export interface ParentWithAccess {
  id: number;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
}

/** Parents dont au moins un enfant a accepté l'accès à la plateforme — utilisé pour présélectionner
 * automatiquement les destinataires d'un nouveau message (type « Parent »), sans sélection manuelle
 * obligatoire dans la barre de recherche. */
export function listParentsWithPlatformAccess(): Promise<ParentWithAccess[]> {
  return api.get<ParentWithAccess[]>("/parents/with-platform-access");
}

/** List parents of the current tenant (to reuse a parent across siblings). Default size large enough
 * to cover a whole tenant so the client-side `search` filter below actually searches everyone, not
 * just the first page — a real gap when a school has more than a couple dozen parents. */
export function listParents(search?: string, size = 1000): Promise<Parent[]> {
  return api.get<Page<Parent>>("/parents", { query: { size } }).then((p) => {
    const q = (search ?? "").trim().toLowerCase();
    const rows = p.content;
    return q
      ? rows.filter((r) => `${r.firstName} ${r.lastName} ${r.phone ?? ""} ${r.email ?? ""}`.toLowerCase().includes(q))
      : rows;
  });
}

export function createParent(input: ParentInput, userId: number | null = null): Promise<Parent> {
  return api.post<Parent>("/parents", { ...input, userId });
}

export function updateParent(id: number, input: ParentInput): Promise<Parent> {
  return api.put<Parent>(`/parents/${id}`, input);
}

export function getStudentParents(studentId: number): Promise<Parent[]> {
  return api.get<Parent[]>(`/parents/by-student/${studentId}`);
}

/** Enfants (élèves) rattachés à un parent — pour l'encaissement groupé fratrie (§payments). */
export function getParentChildren(parentId: number): Promise<Student[]> {
  return api.get<Student[]>(`/parents/${parentId}/students`);
}

export interface ParentStaffLink {
  staffType: "TEACHER" | "EMPLOYEE";
  staffId: number;
}

/** Ce parent est-il lié à un membre du personnel (§retour comptable, refonte inscription) — pour
 * afficher que la remise personnel s'appliquera automatiquement. Null si aucun lien. */
export function getParentStaffLink(parentId: number): Promise<ParentStaffLink | null> {
  return api.get<ParentStaffLink | null>(`/parents/${parentId}/staff-link`);
}

export function linkParentToStudent(parentId: number, studentId: number, relationship: Relationship): Promise<void> {
  return api.post<void>(`/parents/${parentId}/students/${studentId}`, undefined, { query: { relationship } });
}

/** Désigne le responsable principal (« responsable 1 ») de l'élève. */
export function setPrimaryGuardian(parentId: number, studentId: number): Promise<void> {
  return api.patch<void>(`/parents/${parentId}/students/${studentId}/primary`);
}

export function unlinkParentFromStudent(studentId: number, parentId: number): Promise<void> {
  return api.delete<void>(`/students/${studentId}/parents/${parentId}`);
}

/** Supprime un lien de parenté par son identifiant (ELEVE_PARENT). */
export function deleteParentLink(linkId: number): Promise<void> {
  return api.delete<void>(`/parents/links/${linkId}`);
}

/** Le parent connecté met à jour ses propres coordonnées (jamais son nom). */
export function updateMyParentProfile(input: {
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  occupation?: string | null;
}): Promise<Parent> {
  return api.put<Parent>("/parents/me", input);
}

/** Le parent connecté met à jour sa propre photo. */
export function updateMyParentPhoto(photoUrl: string): Promise<Parent> {
  return api.patch<Parent>("/parents/me/photo", undefined, { query: { photoUrl } });
}

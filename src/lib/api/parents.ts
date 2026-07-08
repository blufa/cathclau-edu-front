import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type { Parent } from "@/lib/types/student";

export type Relationship = "FATHER" | "MOTHER" | "GUARDIAN";

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  FATHER: "Père",
  MOTHER: "Mère",
  GUARDIAN: "Tuteur",
};

export interface ParentInput {
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  occupation?: string | null;
  address?: string | null;
}

/** List parents of the current tenant (to reuse a parent across siblings). */
export function listParents(search?: string, size = 20): Promise<Parent[]> {
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

/** Le parent connecté met à jour sa propre photo. */
export function updateMyParentPhoto(photoUrl: string): Promise<Parent> {
  return api.patch<Parent>("/parents/me/photo", undefined, { query: { photoUrl } });
}

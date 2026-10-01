import { api } from "@/lib/api/client";

export interface DirectoryEntry {
  firstName: string;
  lastName: string;
  studentNumber: string | null;
  birthDate: string | null;
  originSchool: string | null;
  schoolName: string | null;
  lastClass: string | null;
  lastDecision: string | null;
  unpaidMonths: number;
  overallAverage: string | null;
}

/** Cross-school lookup of a transferred student (exact matricule or name ≥ 3 chars). */
export function searchDirectory(params: { matricule?: string; name?: string }): Promise<DirectoryEntry[]> {
  return api.get<DirectoryEntry[]>("/directory/students", {
    query: { matricule: params.matricule || undefined, name: params.name || undefined },
  });
}

/** Suggest platform school names (origin school of a transferred student). */
export function searchSchools(q: string): Promise<string[]> {
  return api.get<string[]>("/directory/schools", { query: { q: q || undefined } });
}

/** Suggest platform "previous class" labels already entered (ex. "CM2", "10ème"). */
export function searchPreviousClasses(q: string): Promise<string[]> {
  return api.get<string[]>("/directory/previous-classes", { query: { q: q || undefined } });
}

/** Suggest first names already used by another student/parent of THIS tenant (§retour comptable) —
 * contrairement à searchSchools/searchPreviousClasses, scopé au tenant. */
export function suggestFirstNames(q: string): Promise<string[]> {
  return api.get<string[]>("/directory/first-names", { query: { q: q || undefined } });
}

/** Suggest last names already used by another student/parent of THIS tenant (§retour comptable) —
 * utile pour une fratrie ou un nom déjà connu de l'école. */
export function suggestLastNames(q: string): Promise<string[]> {
  return api.get<string[]>("/directory/last-names", { query: { q: q || undefined } });
}

/** Suggest addresses already used by another student/parent of THIS tenant (§retour comptable). */
export function suggestAddresses(q: string): Promise<string[]> {
  return api.get<string[]>("/directory/addresses", { query: { q: q || undefined } });
}

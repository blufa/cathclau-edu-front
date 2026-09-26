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

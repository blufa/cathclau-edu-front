import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type {
  AnneeScolaire,
  Classe,
  ClassStudent,
  CreateClassInput,
  EnrollmentCountInfo,
  Niveau,
  Salle,
} from "@/lib/types/academics";

// ── Academic years ──────────────────────────────────────────────────────────
export function listAcademicYears(): Promise<AnneeScolaire[]> {
  return api.get<AnneeScolaire[]>("/academics/academic-years");
}

/** Current academic year, or null when none is set (the backend returns 404). */
export async function getCurrentAcademicYear(): Promise<AnneeScolaire | null> {
  try {
    return await api.get<AnneeScolaire>("/academics/academic-years/current");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Classes ───────────────────────────────────────────────────────────────--
export function listClasses(academicYearId: number): Promise<Classe[]> {
  return api.get<Classe[]>("/academics/classes", { query: { academicYearId } });
}

export function getClass(id: number): Promise<Classe> {
  return api.get<Classe>(`/academics/classes/${id}`);
}

export function createClass(input: CreateClassInput): Promise<Classe> {
  return api.post<Classe>("/academics/classes", input);
}

export function updateClass(id: number, input: CreateClassInput): Promise<Classe> {
  return api.put<Classe>(`/academics/classes/${id}`, input);
}

export function deleteClass(id: number): Promise<void> {
  return api.delete<void>(`/academics/classes/${id}`);
}

export function getClassStudents(id: number): Promise<ClassStudent[]> {
  return api.get<ClassStudent[]>(`/academics/classes/${id}/students`);
}

export function getEnrollmentCount(id: number): Promise<EnrollmentCountInfo> {
  return api.get<EnrollmentCountInfo>(`/academics/classes/${id}/enrollment-count`);
}

// ── Referentials ──────────────────────────────────────────────────────────--
export function listLevels(): Promise<Niveau[]> {
  return api.get<Niveau[]>("/academics/levels");
}

export function listRooms(): Promise<Salle[]> {
  return api.get<Salle[]>("/academics/rooms");
}

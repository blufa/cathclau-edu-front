import { api } from "@/lib/api/client";
import type { LessonEntry, LessonInput } from "@/lib/types/lesson";

export function listLessons(params?: { classId?: number; subjectId?: number; teacherId?: number }): Promise<LessonEntry[]> {
  return api.get<LessonEntry[]>("/lessons", { query: { classId: params?.classId, subjectId: params?.subjectId, teacherId: params?.teacherId } });
}

/** Cahier de textes de la classe d'un élève (portail élève / parent). */
export function listStudentLessons(studentId: number): Promise<LessonEntry[]> {
  return api.get<LessonEntry[]>(`/lessons/student/${studentId}`);
}

export function createLesson(input: LessonInput): Promise<LessonEntry> {
  return api.post<LessonEntry>("/lessons", input);
}

export function updateLesson(id: number, input: LessonInput): Promise<LessonEntry> {
  return api.put<LessonEntry>(`/lessons/${id}`, input);
}

/** `durationMinutes` : durée réellement effectuée si elle diffère de la durée planifiée (ex. rattrapage).
 * `confirmedWithoutCheckin` : la personne qui valide a vu qu'aucun pointage enseignant ne correspond
 * à cette séance et confirme malgré tout (§retour fondateurs, contrôle anti-fraude) — trace d'audit
 * dédiée côté backend, jamais un blocage. */
export function markLessonDone(
  id: number, durationMinutes?: number | null, confirmedWithoutCheckin?: boolean,
): Promise<LessonEntry> {
  return api.patch<LessonEntry>(`/lessons/${id}/done`, {
    durationMinutes: durationMinutes ?? null,
    confirmedWithoutCheckin: confirmedWithoutCheckin ?? null,
  });
}

export function markLessonPlanned(id: number): Promise<LessonEntry> {
  return api.patch<LessonEntry>(`/lessons/${id}/plan`);
}

export function deleteLesson(id: number): Promise<void> {
  return api.delete<void>(`/lessons/${id}`);
}

export type LessonStatus = "PLANNED" | "DONE";

export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  PLANNED: "Planifiée",
  DONE: "Réalisée",
};

export interface LessonEntry {
  id: number;
  classId: number;
  /** Null pour un enseignant unique (moniteur maternelle/primaire) qui log sa journée sans matière précise. */
  subjectId: number | null;
  teacherId: number | null;
  lessonDate: string;
  title: string;
  content: string | null;
  homework: string | null;
  durationMinutes: number | null;
  status: LessonStatus;
  createdAt: string | null;
}

export interface LessonInput {
  classId: number;
  subjectId?: number | null;
  teacherId?: number | null;
  lessonDate?: string | null;
  title: string;
  content?: string | null;
  homework?: string | null;
  durationMinutes?: number | null;
  status?: LessonStatus;
}

export type LessonStatus = "PLANNED" | "DONE";

export const LESSON_STATUS_LABEL: Record<LessonStatus, string> = {
  PLANNED: "Planifiée",
  DONE: "Réalisée",
};

export interface LessonEntry {
  id: number;
  classId: number;
  subjectId: number;
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
  subjectId: number;
  teacherId?: number | null;
  lessonDate?: string | null;
  title: string;
  content?: string | null;
  homework?: string | null;
  durationMinutes?: number | null;
  status?: LessonStatus;
}

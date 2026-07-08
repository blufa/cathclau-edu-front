import { api } from "@/lib/api/client";
import type {
  AttendanceEntryInput,
  AttendanceStats,
  AttendanceStatus,
  StudentAttendance,
  TeacherAttendance,
  TeacherAttendanceStatus,
  UnjustifiedAlert,
} from "@/lib/types/attendance";

/** Record attendance for an entire class at once (class roll call). */
export function recordBulkAttendance(
  classId: number,
  date: string,
  attendances: AttendanceEntryInput[],
): Promise<StudentAttendance[]> {
  return api.post<StudentAttendance[]>("/attendance/students/bulk", { classId, date, attendances });
}

/** Attendance records for a class on a given date. */
export function getClassAttendance(classId: number, date: string): Promise<StudentAttendance[]> {
  return api.get<StudentAttendance[]>(`/attendance/students/class/${classId}`, { query: { date } });
}

/** Historique de présence d'un élève sur une période (from/to inclus). */
export function getStudentAttendanceRange(
  studentId: number,
  from: string,
  to: string,
): Promise<StudentAttendance[]> {
  return api.get<StudentAttendance[]>(`/attendance/students/student/${studentId}`, { query: { from, to } });
}

/** Liste des absents d'une classe pour une date (PDF) — object URL local. */
export function getAbsenteeListPdfObjectUrl(classId: number, date: string): Promise<string> {
  return api.blobUrl(`/attendance/students/class/${classId}/absentees/download`, { query: { date } });
}

/** Rapport des retards d'une classe sur une période (PDF) — object URL local. */
export function getLatenessReportPdfObjectUrl(classId: number, from: string, to: string): Promise<string> {
  return api.blobUrl(`/attendance/students/class/${classId}/lateness/download`, { query: { from, to } });
}

/** Correct an attendance record's status/reason. */
export function updateAttendance(
  id: number,
  status: AttendanceStatus,
  reason?: string,
): Promise<StudentAttendance> {
  return api.put<StudentAttendance>(`/attendance/students/${id}`, undefined, { query: { status, reason } });
}

export function markParentNotified(id: number): Promise<void> {
  return api.put<void>(`/attendance/students/${id}/notify-parent`);
}

/** Justifier (ou non) une absence : justifié + motif + pièce. */
export function justifyAttendance(id: number, input: { justified: boolean; reason?: string | null; justificationDoc?: string | null }): Promise<StudentAttendance> {
  return api.patch<StudentAttendance>(`/attendance/students/${id}/justify`, input);
}

/** Élèves d'une classe avec ≥ seuil absences non justifiées sur la période (alerte convocation). */
export function getUnjustifiedAlerts(classId: number, params?: { from?: string; to?: string; threshold?: number }): Promise<UnjustifiedAlert[]> {
  return api.get<UnjustifiedAlert[]>(`/attendance/students/class/${classId}/unjustified-alerts`, { query: { from: params?.from, to: params?.to, threshold: params?.threshold } });
}

export function getStudentAttendanceStats(
  studentId: number,
  from?: string,
  to?: string,
): Promise<AttendanceStats> {
  return api.get<AttendanceStats>(`/attendance/students/${studentId}/stats`, { query: { from, to } });
}

// ── Pointage par scan de carte (élève + enseignant) ─────────────────────────
export type ScanSubjectType = "STUDENT" | "TEACHER";
export interface ScanResult {
  subjectType: string;
  subjectId: number;
  name: string | null;
  status: AttendanceStatus;
  date: string;
}
export function scanAttendance(input: { subjectType: ScanSubjectType; subjectId: number; status: AttendanceStatus }): Promise<ScanResult> {
  return api.post<ScanResult>("/attendance/scan", input);
}

// ── Récap mensuel enseignant (Phase 2) ──────────────────────────────────────
export interface TeacherMonthlySummary {
  teacherId: number;
  year: number;
  month: number;
  presentDays: number;
  absentDays: number;
  totalLateMinutes: number;
  dueMinutes: number;
  absentMinutes: number;
  effectiveMinutes: number;
}
export function getTeacherMonthlySummary(teacherId: number, year: number, month: number): Promise<TeacherMonthlySummary> {
  return api.get<TeacherMonthlySummary>(`/attendance/teachers/${teacherId}/monthly-summary`, { query: { year, month } });
}

// ── Teacher attendance (separate table) ─────────────────────────────────────
export function recordTeacherAttendance(
  teacherId: number,
  date: string,
  status: TeacherAttendanceStatus,
  reason?: string | null,
): Promise<TeacherAttendance> {
  return api.post<TeacherAttendance>("/attendance/teachers", { teacherId, date, status, reason });
}

export function getTeacherAttendance(teacherId: number, from: string, to: string): Promise<TeacherAttendance[]> {
  return api.get<TeacherAttendance[]>(`/attendance/teachers/teacher/${teacherId}`, { query: { from, to } });
}


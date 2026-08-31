import { api } from "@/lib/api/client";
import type {
  AttendanceEntryInput,
  AttendanceOutcome,
  AttendanceStats,
  AttendanceStatus,
  ScanDirection,
  StudentAttendance,
  StudentCheckin,
  TeacherAttendance,
  TeacherAttendanceStatus,
  TeacherCheckin,
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

// ── Pointage par scan de carte (élève + enseignant) : entrée/sortie de séance ──
export type ScanSubjectType = "STUDENT" | "TEACHER";
export interface ScanResult {
  subjectType: string;
  subjectId: number;
  name: string | null;
  direction: ScanDirection;
  /** Entrée uniquement : statut calculé automatiquement vs l'heure de début de la séance. */
  outcome: AttendanceOutcome | null;
  /** Entrée uniquement. */
  lateMinutes: number | null;
  checkInTime: string | null;
  /** Sortie uniquement. */
  checkOutTime: string | null;
  /** Sortie uniquement : durée réalisée (sortie - entrée), en minutes. */
  realizedMinutes: number | null;
  /** Sortie uniquement : durée prévue par l'emploi du temps, en minutes. */
  scheduledMinutes: number | null;
  /** Sortie élève uniquement : classe de cycle maternelle/primaire — le badge de retrait doit être
   * renseigné avant de considérer la sortie terminée. */
  requiresPickupInfo: boolean | null;
  date: string;
}
export function scanAttendance(input: { subjectType: ScanSubjectType; subjectId: number; direction: ScanDirection }): Promise<ScanResult> {
  return api.post<ScanResult>("/attendance/scan", input);
}

/** Marquer manuellement un élève absent aujourd'hui (un scan ne peut jamais produire ce statut). */
export function markStudentAbsent(studentId: number, reason?: string): Promise<StudentAttendance> {
  return api.post<StudentAttendance>(`/attendance/students/${studentId}/mark-absent`, undefined, { query: { reason } });
}

/** Marquer manuellement un enseignant absent aujourd'hui. */
export function markTeacherAbsent(teacherId: number, reason?: string): Promise<TeacherAttendance> {
  return api.post<TeacherAttendance>(`/attendance/teachers/${teacherId}/mark-absent`, undefined, { query: { reason } });
}

/** Correction manuelle : saisir l'heure d'entrée d'un élève pour une date donnée — le retard est
 * calculé automatiquement vs l'emploi du temps, comme pour un scan. */
export function recordStudentManualEntry(studentId: number, date: string, checkInTime: string): Promise<StudentCheckin> {
  return api.post<StudentCheckin>(`/attendance/students/${studentId}/manual-entry`, undefined, { query: { date, checkInTime } });
}

/** Correction manuelle : saisir l'heure d'entrée d'un enseignant pour une date donnée. */
export function recordTeacherManualEntry(teacherId: number, date: string, checkInTime: string): Promise<TeacherCheckin> {
  return api.post<TeacherCheckin>(`/attendance/teachers/${teacherId}/manual-entry`, undefined, { query: { date, checkInTime } });
}

// ── Badge de retrait (maternelle/primaire) ──────────────────────────────────
export interface ChildPickup {
  id: number;
  studentId: number;
  classId: number;
  pickupDate: string;
  pickupTime: string;
  pickerParentId: number | null;
  pickerName: string;
  pickerRelation: string | null;
}

/** Enregistre qui est venu récupérer l'enfant — un parent déjà lié (pickerParentId) ou une personne
 * saisie librement (pickerName + pickerRelation). */
export function recordChildPickup(studentId: number, input: { pickerParentId?: number; pickerName?: string; pickerRelation?: string }): Promise<ChildPickup> {
  return api.post<ChildPickup>(`/attendance/students/${studentId}/pickup`, undefined, { query: input });
}

/** Retraits d'un élève à une date donnée (historique/audit). */
export function getChildPickups(studentId: number, date: string): Promise<ChildPickup[]> {
  return api.get<ChildPickup[]>(`/attendance/students/${studentId}/pickups`, { query: { date } });
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

/** Pointages (par séance) d'un enseignant à une date donnée — pour retrouver à quelle heure il a
 * pointé pour une séance précise (ex. cahier de textes → durée réalisée depuis le pointage). */
export function getTeacherCheckins(teacherId: number, date: string): Promise<TeacherCheckin[]> {
  return api.get<TeacherCheckin[]>(`/attendance/teachers/${teacherId}/checkins`, { query: { date } });
}


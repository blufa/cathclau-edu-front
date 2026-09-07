import { api } from "@/lib/api/client";
import type {
  AttendanceEntryInput,
  AttendanceOutcome,
  AttendanceStats,
  AttendanceStatus,
  EmployeeAttendance,
  EmployeeAttendanceStats,
  EmployeeAttendanceStatus,
  EmployeeMonthlySummary,
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
export type ScanSubjectType = "STUDENT" | "TEACHER" | "EMPLOYEE";
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

/** Correction manuelle : saisir l'heure de sortie d'un enseignant pour une date donnée — utile quand
 * le badge a été oublié pour toute la séance. Crée le pointage s'il n'existait pas encore. */
export function recordTeacherManualExit(teacherId: number, date: string, checkOutTime: string): Promise<TeacherCheckin> {
  return api.post<TeacherCheckin>(`/attendance/teachers/${teacherId}/manual-exit`, undefined, { query: { date, checkOutTime } });
}

/** Correction manuelle : saisir l'heure de sortie d'un élève pour une date donnée — utile quand le
 * badge a été oublié pour toute la séance. Crée le pointage s'il n'existait pas encore. */
export function recordStudentManualExit(studentId: number, date: string, checkOutTime: string): Promise<StudentCheckin> {
  return api.post<StudentCheckin>(`/attendance/students/${studentId}/manual-exit`, undefined, { query: { date, checkOutTime } });
}

/** Pointages (par séance) d'un élève à une date donnée — heure d'entrée/sortie par créneau (ex.
 * dashboard parent : à quelle heure l'enfant est rentré/sorti de chaque cours). */
export function getStudentCheckins(studentId: number, date: string): Promise<StudentCheckin[]> {
  return api.get<StudentCheckin[]>(`/attendance/students/${studentId}/checkins`, { query: { date } });
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
  totalEarlyMinutes: number;
  dueMinutes: number;
  absentMinutes: number;
  effectiveMinutes: number;
}
export function getTeacherMonthlySummary(teacherId: number, year: number, month: number): Promise<TeacherMonthlySummary> {
  return api.get<TeacherMonthlySummary>(`/attendance/teachers/${teacherId}/monthly-summary`, { query: { year, month } });
}

// ── Réglages : marge de transition entre salles, horaire du personnel, récréation ───
export interface AttendanceSettings {
  id: number | null;
  tenantId: number;
  transitionMarginMinutes: number;
  /** Horaire de référence du personnel non-enseignant (un seul horaire pour tout le personnel). */
  employeeCheckInTime: string;
  employeeCheckOutTime: string;
}
export interface RecessWindow {
  id: number;
  tenantId: number;
  label: string | null;
  startTime: string;
  endTime: string;
}
export function getAttendanceSettings(): Promise<AttendanceSettings> {
  return api.get<AttendanceSettings>("/attendance/settings");
}
export function updateAttendanceSettings(transitionMarginMinutes: number): Promise<AttendanceSettings> {
  return api.put<AttendanceSettings>("/attendance/settings", { transitionMarginMinutes });
}
export function updateEmployeeAttendanceHours(checkInTime: string, checkOutTime: string): Promise<AttendanceSettings> {
  return api.put<AttendanceSettings>("/attendance/settings/employee-hours", { checkInTime, checkOutTime });
}
export function listRecessWindows(): Promise<RecessWindow[]> {
  return api.get<RecessWindow[]>("/attendance/settings/recess-windows");
}
export function addRecessWindow(label: string, startTime: string, endTime: string): Promise<RecessWindow> {
  return api.post<RecessWindow>("/attendance/settings/recess-windows", { label, startTime, endTime });
}
export function deleteRecessWindow(id: number): Promise<void> {
  return api.delete<void>(`/attendance/settings/recess-windows/${id}`);
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

// ── Employee attendance (personnel non-enseignant — un seul pointage par jour) ──
export function recordEmployeeAttendance(
  employeeId: number,
  date: string,
  status: EmployeeAttendanceStatus,
  reason?: string | null,
): Promise<EmployeeAttendance> {
  return api.post<EmployeeAttendance>("/attendance/employees", { employeeId, date, status, reason });
}

/** Marquer manuellement un membre du personnel absent aujourd'hui. */
export function markEmployeeAbsent(employeeId: number, reason?: string): Promise<EmployeeAttendance> {
  return api.post<EmployeeAttendance>(`/attendance/employees/${employeeId}/mark-absent`, undefined, { query: { reason } });
}

/** Correction manuelle : saisir l'heure d'entrée d'un membre du personnel pour une date donnée. */
export function recordEmployeeManualEntry(employeeId: number, date: string, checkInTime: string): Promise<EmployeeAttendance> {
  return api.post<EmployeeAttendance>(`/attendance/employees/${employeeId}/manual-entry`, undefined, { query: { date, checkInTime } });
}

/** Correction manuelle : saisir l'heure de sortie d'un membre du personnel pour une date donnée —
 * utile quand le badge a été oublié pour toute la journée. Crée le pointage s'il n'existait pas encore. */
export function recordEmployeeManualExit(employeeId: number, date: string, checkOutTime: string): Promise<EmployeeAttendance> {
  return api.post<EmployeeAttendance>(`/attendance/employees/${employeeId}/manual-exit`, undefined, { query: { date, checkOutTime } });
}

export function getEmployeeAttendance(employeeId: number, from: string, to: string): Promise<EmployeeAttendance[]> {
  return api.get<EmployeeAttendance[]>(`/attendance/employees/employee/${employeeId}`, { query: { from, to } });
}

export function getEmployeeAttendanceStats(employeeId: number, from?: string, to?: string): Promise<EmployeeAttendanceStats> {
  return api.get<EmployeeAttendanceStats>(`/attendance/employees/${employeeId}/stats`, { query: { from, to } });
}

export function getEmployeeMonthlySummary(employeeId: number, year: number, month: number): Promise<EmployeeMonthlySummary> {
  return api.get<EmployeeMonthlySummary>(`/attendance/employees/${employeeId}/monthly-summary`, { query: { year, month } });
}


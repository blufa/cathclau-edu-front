/** Attendance contracts mirrored from the backend attendance module. */

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE";

export interface StudentAttendance {
  id: number;
  tenantId: number | null;
  studentId: number;
  classId: number;
  date: string;
  status: AttendanceStatus;
  reason: string | null;
  parentNotified: boolean | null;
  justified?: boolean | null;
  justificationDoc?: string | null;
  /** Heure du 1er pointage du jour (scan). */
  checkInTime?: string | null;
  /** Retard cumulé du jour (somme des retards de chaque séance pointée). */
  lateMinutes?: number | null;
}

export interface UnjustifiedAlert {
  studentId: number;
  unjustifiedCount: number;
}

export interface AttendanceEntryInput {
  studentId: number;
  status: AttendanceStatus;
  reason?: string | null;
}

export interface AttendanceStats {
  studentId: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  attendanceRate: string;
}

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Présent",
  ABSENT: "Absent",
  LATE: "Retard",
};

// ── Teacher attendance (separate table) ─────────────────────────────────────
export type TeacherAttendanceStatus = "PRESENT" | "ABSENT";

export interface TeacherAttendance {
  id: number;
  tenantId: number | null;
  teacherId: number;
  date: string;
  status: TeacherAttendanceStatus;
  reason: string | null;
  /** Heure d'arrivée (pointage), pour le 1er cours du jour. */
  checkInTime: string | null;
  /** Minutes de retard cumulées sur la journée (toutes séances pointées). */
  lateMinutes: number | null;
}

/** Pointage d'une séance précise (§attendance) — heure d'arrivée et retard vs le début du créneau. */
export interface TeacherCheckin {
  id: number;
  teacherId: number;
  checkinDate: string;
  scheduleSlotId: number;
  sessionStart: string;
  sessionEnd: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  lateMinutes: number;
  /** Minutes de départ anticipé (sortie pointée avant la fin prévue) — 0 si la sortie n'a jamais été
   * pointée (bénéfice du doute, pas de pénalité). */
  earlyMinutes: number | null;
}

/** Pointage d'une séance élève (miroir de TeacherCheckin). */
export interface StudentCheckin {
  id: number;
  studentId: number;
  classId: number;
  checkinDate: string;
  scheduleSlotId: number;
  sessionStart: string;
  sessionEnd: string | null;
  checkInTime: string;
  checkOutTime: string | null;
  lateMinutes: number;
  /** Minutes de départ anticipé (sortie pointée avant la fin prévue) — 0 si la sortie n'a jamais été
   * pointée (bénéfice du doute, pas de pénalité). */
  earlyMinutes: number | null;
}

// ── Employee attendance (personnel non-enseignant — un seul pointage par jour) ──
export type EmployeeAttendanceStatus = "PRESENT" | "ABSENT";

export interface EmployeeAttendance {
  id: number;
  tenantId: number | null;
  employeeId: number;
  date: string;
  status: EmployeeAttendanceStatus;
  reason: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  lateMinutes: number | null;
  /** Minutes de départ anticipé (sortie pointée avant l'heure de sortie configurée) — 0 si la sortie
   * n'a jamais été pointée (bénéfice du doute, pas de pénalité). */
  earlyMinutes: number | null;
}

export interface EmployeeAttendanceStats {
  employeeId: number;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  attendanceRate: string;
}

export interface EmployeeMonthlySummary {
  employeeId: number;
  year: number;
  month: number;
  presentDays: number;
  absentDays: number;
  totalLateMinutes: number;
  totalEarlyMinutes: number;
}

// ── Scan par caméra : entrée/sortie de séance, statut calculé automatiquement ───
export type ScanDirection = "ENTRY" | "EXIT";
export type AttendanceOutcome = "PRESENT" | "LATE";

export const SCAN_DIRECTION_LABEL: Record<ScanDirection, string> = { ENTRY: "Entrée", EXIT: "Sortie" };
export const ATTENDANCE_OUTCOME_LABEL: Record<AttendanceOutcome, string> = { PRESENT: "Présent", LATE: "Retard" };

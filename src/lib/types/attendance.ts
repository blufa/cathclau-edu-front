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
}

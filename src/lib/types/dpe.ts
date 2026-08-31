/** DPE/DCE dashboard contracts, mirrored from the backend (kept in sync manually). */

export interface DpeSchoolSummary {
  tenantId: number;
  schoolName: string;
  city: string | null;
  status: "ACTIVE" | "INACTIVE";
  studentCount: number;
  teacherCount: number;
  activeTeacherCount: number;
  classCount: number;
}

export interface DpeDashboardOverview {
  schoolCount: number;
  studentCount: number;
  teacherCount: number;
  classCount: number;
  /** Ratio élèves/enseignant global — indicatif, jamais une norme officielle. */
  studentTeacherRatio: string;
  schools: DpeSchoolSummary[];
}

export const DPE_ALERT_TYPES = [
  "SCHOOL_NO_STUDENTS",
  "SCHOOL_NO_TEACHERS",
  "SCHOOL_NO_CLASSES",
  "SCHOOL_INACTIVE",
  "HIGH_STUDENT_TEACHER_RATIO",
] as const;
export type DpeAlertType = (typeof DPE_ALERT_TYPES)[number];

export const DPE_ALERT_TYPE_LABEL: Record<DpeAlertType, string> = {
  SCHOOL_NO_STUDENTS: "Aucun élève",
  SCHOOL_NO_TEACHERS: "Aucun enseignant actif",
  SCHOOL_NO_CLASSES: "Aucune classe",
  SCHOOL_INACTIVE: "École inactive",
  HIGH_STUDENT_TEACHER_RATIO: "Ratio élèves/enseignant élevé",
};

export type DpeAlertPriority = "BASSE" | "MOYENNE" | "HAUTE";
export type DpeAlertStatus = "NOUVELLE" | "EN_COURS" | "RESOLUE";

export interface DpeAlert {
  id: number;
  tenantId: number;
  type: DpeAlertType;
  priorite: DpeAlertPriority;
  description: string;
  statut: DpeAlertStatus;
  createdAt: string;
  updatedAt: string | null;
  resolvedAt: string | null;
}

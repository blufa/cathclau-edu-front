/** Academics contracts mirrored from the backend academics module. */

export type StatutAnneeScolaire = "PLANIFIEE" | "EN_COURS" | "CLOTUREE" | "ARCHIVEE";

export interface AnneeScolaire {
  id: number;
  tenantId: number;
  label: string;
  startDate: string | null;
  endDate: string | null;
  status: StatutAnneeScolaire;
  current: boolean;
  createdAt: string | null;
}

export interface Niveau {
  id: number;
  tenantId: number;
  label: string;
  sortOrder: number;
}

export interface Salle {
  id: number;
  tenantId: number;
  label: string;
  building: string | null;
  capacity: number | null;
  type: string | null;
  available: boolean;
}

export interface Classe {
  id: number;
  tenantId: number;
  levelId: number | null;
  academicYearId: number;
  headTeacherId: number | null;
  roomId: number | null;
  label: string;
  headcount: number | null;
  maxCapacity: number | null;
}

/** Roster projection from GET /classes/{id}/students. */
export interface ClassStudent {
  id: number;
  firstName: string;
  lastName: string;
  studentNumber: string;
  email: string | null;
}

export interface EnrollmentCountInfo {
  classId: number;
  currentCount: number;
  maxCapacity: number | null;
  available: number;
}

/** Body for POST/PUT class — tenantId resolved server-side. */
export interface CreateClassInput {
  levelId: number | null;
  academicYearId: number;
  headTeacherId?: number | null;
  roomId?: number | null;
  label: string;
  maxCapacity: number | null;
}

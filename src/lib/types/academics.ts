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

export type SchoolCycle = "MATERNELLE" | "PRIMAIRE" | "COLLEGE" | "LYCEE" | "SUPERIEUR";

export const SCHOOL_CYCLE_LABEL: Record<SchoolCycle, string> = {
  MATERNELLE: "Maternelle",
  PRIMAIRE: "Primaire",
  COLLEGE: "Collège",
  LYCEE: "Lycée",
  SUPERIEUR: "Supérieur",
};

export interface Niveau {
  id: number;
  tenantId: number;
  label: string;
  sortOrder: number;
  /** Cycle scolaire (maternelle/primaire déclenchent le badge de retrait automatique à la sortie). */
  cycle?: SchoolCycle | null;
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

export type TypeSalle = "SALLE_COURS" | "LABORATOIRE" | "AMPHI" | "SALLE_INFO" | "AUTRE";

export interface Matiere {
  id: number;
  tenantId: number;
  label: string;
  coefficient: string;
  syllabus: string | null;
}

/** Entrée du catalogue officiel MEPUA : matière + coefficient pour un cycle/série donné. */
export interface MatiereModele {
  code: string;
  libelle: string;
  coefficient: string;
}

export type TypePeriode = "TRIMESTRE" | "SEMESTRE";

export interface Periode {
  id: number;
  academicYearId: number;
  label: string;
  type: TypePeriode;
  cycle: SchoolCycle | null;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
  closed: boolean;
}

export interface CreateRoomInput {
  label: string;
  building: string | null;
  capacity: number | null;
  type: TypeSalle;
}

export interface CreateAcademicYearInput {
  label: string;
  startDate: string | null;
  endDate: string | null;
}

export interface CreatePeriodInput {
  label: string;
  cycle: SchoolCycle;
  type: TypePeriode;
  sortOrder: number;
  startDate: string | null;
  endDate: string | null;
}

export type ClassType = "NORMALE" | "EXAMEN";

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
  /** Classe normale ou classe d'examen (§6) — détermine le tarif horaire de paie appliqué. */
  classType: ClassType;
  /** Élève désigné pour scanner les badges de la classe le matin. */
  classRepresentativeStudentId: number | null;
}

export type JourSemaine = "LUNDI" | "MARDI" | "MERCREDI" | "JEUDI" | "VENDREDI" | "SAMEDI";

/** Timetable slot (EmploiDuTemps). Times are "HH:mm[:ss]" strings. */
export interface EmploiDuTemps {
  id: number;
  tenantId: number;
  schoolClassId: number;
  subjectId: number;
  teacherId: number | null;
  roomId: number | null;
  day: JourSemaine;
  startTime: string;
  endTime: string;
}

/** Body for POST/PUT schedule — tenantId resolved server-side. */
export interface CreateScheduleInput {
  schoolClassId: number;
  subjectId: number;
  teacherId: number | null;
  roomId: number | null;
  day: JourSemaine;
  startTime: string;
  endTime: string;
}

/** Créneau effectif d'une semaine précise (récurrent + déplacement/annulation ponctuel appliqué). */
export interface EffectiveScheduleSlot {
  scheduleId: number;
  schoolClassId: number;
  subjectId: number;
  teacherId: number | null;
  roomId: number | null;
  day: JourSemaine;
  startTime: string;
  endTime: string;
  moved: boolean;
  cancelled: boolean;
  originalDay: JourSemaine | null;
  originalStartTime: string | null;
  originalEndTime: string | null;
}

/** Body pour déplacer un créneau récurrent pour une semaine précise (weekStartDate = un lundi). */
export interface MoveScheduleForWeekInput {
  weekStartDate: string;
  newDay: JourSemaine;
  newStartTime: string;
  newEndTime: string;
  newRoomId: number | null;
  newTeacherId: number | null;
  reason?: string | null;
}

/** Subject assignment to a class (ClasseMatiere). */
export interface ClasseMatiere {
  id: number;
  schoolClassId: number;
  subjectId: number;
  teacherId: number | null;
  coefficient: string | null;
  /** Code affecté par le Directeur des Études pour identifier ce professeur sur cette matière
   * (ex. "CH1", "CH2") — généré automatiquement à l'affectation, modifiable ensuite. */
  code: string | null;
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
  classType?: ClassType | null;
}

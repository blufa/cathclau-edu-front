/** Staff (teachers) contracts mirrored from the backend staff module. */

export interface Teacher {
  id: number;
  tenantId: number;
  userId: number | null;
  staffNumber: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  photo: string | null;
  specialization: string | null;
  hireDate: string | null;
  active: boolean;
  employmentStatus: string | null;
  diploma: string | null;
  remunerationType: string | null;
  remunerationRate: string | null;
  teachingAuthorizationNumber: string | null;
  cnssNumber: string | null;
  /** Compte bancaire (RIB/IBAN) optionnel — pour le fichier bancaire de paie. Le téléphone reste
   * prioritaire pour le virement Mobile Money. */
  bankAccount: string | null;
  /** Enseignant exceptionnel pouvant couvrir plusieurs classes en même temps (ex. professeur d'EPS) —
   * désactive la détection de conflit d'emploi du temps sur lui précisément. */
  allowsConcurrentClasses: boolean;
}

/** Body for POST /staff/teachers — tenantId resolved server-side. */
export interface CreateTeacherInput {
  userId?: number | null;
  staffNumber?: string | null;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  specialization?: string | null;
  hireDate?: string | null;
  employmentStatus?: string | null;
  diploma?: string | null;
  remunerationType?: string | null;
  remunerationRate?: string | null;
  teachingAuthorizationNumber?: string | null;
  cnssNumber?: string | null;
  bankAccount?: string | null;
  /** Clé d'idempotence (mode hors-ligne, lib/offline/) : rejouer avec la même clé après une coupure
   * réseau renvoie l'enseignant déjà créé côté serveur au lieu d'en créer un second. */
  idempotencyKey?: string;
}

/** userId reste modifiable en édition : permet de lier un compte créé après coup (ex. « Créer un
 * accès » oublié à la création) — le backend ne le retire jamais si non fourni, voir
 * TeacherUseCase.UpdateTeacherCommand#userId. */
export type UpdateTeacherInput = CreateTeacherInput;

/** Class where the teacher is head teacher (academics ClassPublicInfo). */
export interface TeacherClassInfo {
  id: number;
  label: string;
  levelLabel: string | null;
}

/** A subject assignment of the teacher (academics ClassSubjectPublicInfo). */
export interface TeacherSubjectInfo {
  classId: number;
  subjectId: number;
  coefficient: string;
  teacherId: number;
  teacherCode: string | null;
}

/** A timetable slot (academics ScheduleSlotPublicInfo). */
export interface TeacherScheduleSlot {
  id: number;
  classId: number;
  /** Nul pour une heure creuse sans matière formelle (étude, permanence, TD...) — voir `label`. */
  subjectId: number | null;
  teacherId: number;
  roomId: number | null;
  day: string;
  startTime: string;
  endTime: string;
  label: string | null;
}

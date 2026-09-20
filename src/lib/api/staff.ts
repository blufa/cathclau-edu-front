import { api } from "@/lib/api/client";
import type {
  CreateTeacherInput,
  Teacher,
  TeacherClassInfo,
  TeacherScheduleSlot,
  TeacherSubjectInfo,
  UpdateTeacherInput,
} from "@/lib/types/staff";

export function listTeachers(): Promise<Teacher[]> {
  return api.get<Teacher[]>("/staff/teachers");
}

export function getTeacher(id: number): Promise<Teacher> {
  return api.get<Teacher>(`/staff/teachers/${id}`);
}

/** The teacher record of the currently authenticated user (teacher portal). */
export function getMyTeacher(): Promise<Teacher> {
  return api.get<Teacher>("/staff/teachers/me");
}

/** L'enseignant connecté met à jour ses propres coordonnées (jamais matricule/spécialité). */
export function updateMyTeacherProfile(input: { phone?: string | null; email?: string | null }): Promise<Teacher> {
  return api.put<Teacher>("/staff/teachers/me", input);
}

export function updateMyTeacherPhoto(photoUrl: string): Promise<Teacher> {
  return api.patch<Teacher>("/staff/teachers/me/photo", undefined, { query: { photoUrl } });
}

export function createTeacher(input: CreateTeacherInput): Promise<Teacher> {
  return api.post<Teacher>("/staff/teachers", input);
}

export function updateTeacher(id: number, input: UpdateTeacherInput): Promise<Teacher> {
  return api.put<Teacher>(`/staff/teachers/${id}`, input);
}

/** Définit la photo d'un enseignant par un admin (badge) — distinct du self-service `updateMyTeacherPhoto`. */
export function updateTeacherPhoto(id: number, photoUrl: string): Promise<Teacher> {
  return api.patch<Teacher>(`/staff/teachers/${id}/photo`, undefined, { query: { photoUrl } });
}

/** Marque (ou retire) un enseignant comme pouvant couvrir plusieurs classes en même temps (ex. EPS) —
 * désactive la détection de conflit d'emploi du temps sur lui précisément. */
export function updateTeacherAllowsConcurrentClasses(id: number, allowsConcurrentClasses: boolean): Promise<Teacher> {
  return api.patch<Teacher>(`/staff/teachers/${id}/allows-concurrent-classes`, undefined, { query: { allowsConcurrentClasses } });
}

export function deleteTeacher(id: number): Promise<void> {
  return api.delete<void>(`/staff/teachers/${id}`);
}

export function setTeacherActive(id: number, active: boolean): Promise<Teacher> {
  return api.patch<Teacher>(`/staff/teachers/${id}/${active ? "activate" : "deactivate"}`);
}

export function getTeacherClasses(id: number): Promise<TeacherClassInfo[]> {
  return api.get<TeacherClassInfo[]>(`/staff/teachers/${id}/classes`);
}

export function getTeacherSubjects(id: number): Promise<TeacherSubjectInfo[]> {
  return api.get<TeacherSubjectInfo[]>(`/staff/teachers/${id}/subjects`);
}

export function getTeacherSchedule(id: number): Promise<TeacherScheduleSlot[]> {
  return api.get<TeacherScheduleSlot[]>(`/staff/teachers/${id}/schedule`);
}

// ── Disponibilités de l'enseignant (jour + plage horaire + classe/matière) ────
export interface TeacherAvailability {
  id: number;
  teacherId: number;
  day: string;
  startTime: string;
  endTime: string;
  schoolClassId: number | null;
  subjectId: number | null;
}

export function getTeacherAvailability(id: number): Promise<TeacherAvailability[]> {
  return api.get<TeacherAvailability[]>(`/staff/teachers/${id}/availability`);
}
export function addTeacherAvailability(
  id: number,
  input: { day: string; startTime: string; endTime: string; schoolClassId: number; subjectId: number },
): Promise<TeacherAvailability> {
  return api.post<TeacherAvailability>(`/staff/teachers/${id}/availability`, input);
}
export function deleteTeacherAvailability(slotId: number): Promise<void> {
  return api.delete<void>(`/staff/teachers/availability/${slotId}`);
}

// ── Charge horaire mensuelle (§2 grille horaire) ─────────────────────────────
export interface TeacherMonthlyWorkload {
  teacherId: number;
  year: number;
  month: number;
  totalMonthlyMinutes: number;
  totalMonthlyHours: string;
  sessionCount: number;
}
export function getTeacherMonthlyWorkload(id: number, year: number, month: number): Promise<TeacherMonthlyWorkload> {
  return api.get<TeacherMonthlyWorkload>(`/staff/teachers/${id}/workload/monthly`, { query: { year, month } });
}

// ── Classes enseignées (affectation directe, checklist sur la fiche) ──────────
export function getAssignedClasses(teacherId: number): Promise<number[]> {
  return api.get<number[]>(`/staff/teachers/${teacherId}/assigned-classes`);
}
export function setAssignedClasses(teacherId: number, classIds: number[]): Promise<number[]> {
  return api.put<number[]>(`/staff/teachers/${teacherId}/assigned-classes`, { classIds });
}

// ── Matières enseignées (affectation directe, liste sur la fiche) ─────────────
export function getAssignedSubjects(teacherId: number): Promise<number[]> {
  return api.get<number[]>(`/staff/teachers/${teacherId}/assigned-subjects`);
}
export function setAssignedSubjects(teacherId: number, subjectIds: number[]): Promise<number[]> {
  return api.put<number[]>(`/staff/teachers/${teacherId}/assigned-subjects`, { subjectIds });
}

// ── Niveaux où l'enseignant est habilité à enseigner (affectation directe, liste sur la fiche) ──
export function getAssignedLevels(teacherId: number): Promise<number[]> {
  return api.get<number[]>(`/staff/teachers/${teacherId}/assigned-levels`);
}
export function setAssignedLevels(teacherId: number, levelIds: number[]): Promise<number[]> {
  return api.put<number[]>(`/staff/teachers/${teacherId}/assigned-levels`, { levelIds });
}

/** Ids des enseignants affectés à une matière (pour proposer les profs au choix de la matière). */
export function getTeachersBySubject(subjectId: number): Promise<number[]> {
  return api.get<number[]>(`/staff/teachers/by-subject/${subjectId}`);
}

// ── Charge horaire hebdomadaire (§4.1) ───────────────────────────────────────
export interface TeacherWorkload {
  teacherId: number;
  totalWeeklyMinutes: number;
  totalWeeklyHours: string;
  slotCount: number;
  minutesByDay: Record<string, number>;
}

/** Charge horaire hebdomadaire consolidée d'un enseignant (somme des créneaux d'emploi du temps). */
export function getTeacherWorkload(id: number): Promise<TeacherWorkload> {
  return api.get<TeacherWorkload>(`/staff/teachers/${id}/workload`);
}

// ── Personnel non-enseignant (administratif, direction, soutien) — §7.1 ───────
export type EmployeeCategory = "ADMINISTRATIVE" | "DIRECTION" | "SUPPORT";

export interface Employee {
  id: number;
  tenantId: number | null;
  userId: number | null;
  employeeNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  category: EmployeeCategory;
  jobTitle: string | null;
  hireDate: string | null;
  baseSalary: string | null;
  cnssNumber: string | null;
  /** Compte bancaire (RIB/IBAN) optionnel. Le téléphone reste prioritaire pour le virement Mobile Money. */
  bankAccount: string | null;
  active: boolean;
  /** Fiche Teacher de la même personne si elle enseigne aussi, en plus de son poste — lien manuel,
   * utilisé pour générer une fiche de paie combinée (salaire fixe + heures d'enseignement). */
  linkedTeacherId: number | null;
  /** Photo pour le badge personnel — optionnelle, définie par un admin. */
  photo: string | null;
}

export interface EmployeeInput {
  userId?: number | null;
  employeeNumber?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  category: EmployeeCategory;
  jobTitle?: string | null;
  hireDate?: string | null;
  baseSalary?: number | null;
  cnssNumber?: string | null;
  bankAccount?: string | null;
  linkedTeacherId?: number | null;
}

export function listEmployees(category?: EmployeeCategory): Promise<Employee[]> {
  return api.get<Employee[]>("/staff/employees", { query: { category } });
}
export function getEmployee(id: number): Promise<Employee> {
  return api.get<Employee>(`/staff/employees/${id}`);
}
export function createEmployee(input: EmployeeInput): Promise<Employee> {
  return api.post<Employee>("/staff/employees", input);
}
export function updateEmployee(id: number, input: EmployeeInput): Promise<Employee> {
  return api.put<Employee>(`/staff/employees/${id}`, input);
}
export function updateEmployeePhoto(id: number, photoUrl: string): Promise<Employee> {
  return api.patch<Employee>(`/staff/employees/${id}/photo`, undefined, { query: { photoUrl } });
}
export function setEmployeeActive(id: number, active: boolean): Promise<Employee> {
  return api.patch<Employee>(`/staff/employees/${id}/${active ? "activate" : "deactivate"}`);
}
export function deleteEmployee(id: number): Promise<void> {
  return api.delete<void>(`/staff/employees/${id}`);
}

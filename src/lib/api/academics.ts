import { api } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type {
  AnneeScolaire,
  Classe,
  ClasseMatiere,
  ClassStudent,
  CreateAcademicYearInput,
  CreateClassInput,
  CreatePeriodInput,
  CreateRoomInput,
  CreateScheduleInput,
  EmploiDuTemps,
  EnrollmentCountInfo,
  JourSemaine,
  Matiere,
  Niveau,
  Periode,
  Salle,
  StatutAnneeScolaire,
} from "@/lib/types/academics";

// ── Academic years ──────────────────────────────────────────────────────────
export function listAcademicYears(): Promise<AnneeScolaire[]> {
  return api.get<AnneeScolaire[]>("/academics/academic-years");
}

/** Current academic year, or null when none is set (the backend returns 404). */
export async function getCurrentAcademicYear(): Promise<AnneeScolaire | null> {
  try {
    return await api.get<AnneeScolaire>("/academics/academic-years/current");
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

// ── Classes ───────────────────────────────────────────────────────────────--
export function listClasses(academicYearId: number): Promise<Classe[]> {
  return api.get<Classe[]>("/academics/classes", { query: { academicYearId } });
}

export function getClass(id: number): Promise<Classe> {
  return api.get<Classe>(`/academics/classes/${id}`);
}

export function createClass(input: CreateClassInput): Promise<Classe> {
  return api.post<Classe>("/academics/classes", input);
}

export function updateClass(id: number, input: CreateClassInput): Promise<Classe> {
  return api.put<Classe>(`/academics/classes/${id}`, input);
}

export function deleteClass(id: number): Promise<void> {
  return api.delete<void>(`/academics/classes/${id}`);
}

export function getClassStudents(id: number): Promise<ClassStudent[]> {
  return api.get<ClassStudent[]>(`/academics/classes/${id}/students`);
}

export function getEnrollmentCount(id: number): Promise<EnrollmentCountInfo> {
  return api.get<EnrollmentCountInfo>(`/academics/classes/${id}/enrollment-count`);
}

export function listClassSubjects(classId: number): Promise<ClasseMatiere[]> {
  return api.get<ClasseMatiere[]>(`/academics/classes/${classId}/subjects`);
}
export function assignClassSubject(classId: number, subjectId: number, teacherId?: number, coefficient?: number): Promise<ClasseMatiere> {
  return api.post<ClasseMatiere>(`/academics/classes/${classId}/subjects`, undefined, {
    query: { subjectId, teacherId, coefficient },
  });
}
/** Désigne (ou retire avec teacherId=null) le professeur principal de la classe. */
export function setClassHeadTeacher(classId: number, teacherId: number | null): Promise<Classe> {
  return api.patch<Classe>(`/academics/classes/${classId}/head-teacher`, undefined, {
    query: teacherId != null ? { teacherId } : {},
  });
}
export function removeClassSubject(classId: number, id: number): Promise<void> {
  return api.delete<void>(`/academics/classes/${classId}/subjects/${id}`);
}

// ── Timetable ─────────────────────────────────────────────────────────────--
export function searchSchedules(params: {
  classId?: number;
  teacherId?: number;
  roomId?: number;
  day?: JourSemaine;
}): Promise<EmploiDuTemps[]> {
  return api.get<EmploiDuTemps[]>("/academics/schedules", { query: { ...params } });
}
export function getScheduleByClass(classId: number): Promise<EmploiDuTemps[]> {
  return api.get<EmploiDuTemps[]>(`/academics/schedules/by-class/${classId}`);
}
export function getScheduleByTeacher(teacherId: number): Promise<EmploiDuTemps[]> {
  return api.get<EmploiDuTemps[]>(`/academics/schedules/by-teacher/${teacherId}`);
}
export function createSchedule(input: CreateScheduleInput): Promise<EmploiDuTemps> {
  return api.post<EmploiDuTemps>("/academics/schedules", input);
}
export function updateSchedule(id: number, input: CreateScheduleInput): Promise<EmploiDuTemps> {
  return api.put<EmploiDuTemps>(`/academics/schedules/${id}`, input);
}
export function deleteSchedule(id: number): Promise<void> {
  return api.delete<void>(`/academics/schedules/${id}`);
}

// ── Academic years (admin) ────────────────────────────────────────────────--
export function createAcademicYear(input: CreateAcademicYearInput): Promise<AnneeScolaire> {
  return api.post<AnneeScolaire>("/academics/academic-years", input);
}
export function updateAcademicYear(id: number, input: CreateAcademicYearInput): Promise<AnneeScolaire> {
  return api.put<AnneeScolaire>(`/academics/academic-years/${id}`, input);
}
export function changeAcademicYearStatus(id: number, status: StatutAnneeScolaire): Promise<AnneeScolaire> {
  return api.patch<AnneeScolaire>(`/academics/academic-years/${id}/status`, undefined, { query: { status } });
}
export function setCurrentAcademicYear(id: number): Promise<AnneeScolaire> {
  return api.patch<AnneeScolaire>(`/academics/academic-years/${id}/set-current`);
}
export function startAcademicYear(id: number): Promise<AnneeScolaire> {
  return api.put<AnneeScolaire>(`/academics/academic-years/${id}/start`);
}
export function closeAcademicYear(id: number): Promise<AnneeScolaire> {
  return api.put<AnneeScolaire>(`/academics/academic-years/${id}/close`);
}

// ── Periods ───────────────────────────────────────────────────────────────--
export function listPeriods(academicYearId: number): Promise<Periode[]> {
  return api.get<Periode[]>(`/academics/academic-years/${academicYearId}/periods`);
}
export function createPeriod(academicYearId: number, input: CreatePeriodInput): Promise<Periode> {
  return api.post<Periode>(`/academics/academic-years/${academicYearId}/periods`, input);
}
export function updatePeriod(periodId: number, input: CreatePeriodInput): Promise<Periode> {
  return api.put<Periode>(`/academics/academic-years/periods/${periodId}`, input);
}
export function closePeriod(periodId: number): Promise<Periode> {
  return api.put<Periode>(`/academics/academic-years/periods/${periodId}/close`);
}

// ── Levels ────────────────────────────────────────────────────────────────--
export function listLevels(): Promise<Niveau[]> {
  return api.get<Niveau[]>("/academics/levels");
}
export function createLevel(label: string, sortOrder: number): Promise<Niveau> {
  return api.post<Niveau>("/academics/levels", undefined, { query: { label, sortOrder } });
}
export function updateLevel(id: number, label: string, sortOrder: number): Promise<Niveau> {
  return api.put<Niveau>(`/academics/levels/${id}`, undefined, { query: { label, sortOrder } });
}
export function deleteLevel(id: number): Promise<void> {
  return api.delete<void>(`/academics/levels/${id}`);
}

// ── Rooms ─────────────────────────────────────────────────────────────────--
export function listRooms(): Promise<Salle[]> {
  return api.get<Salle[]>("/academics/rooms");
}
export function createRoom(input: CreateRoomInput): Promise<Salle> {
  return api.post<Salle>("/academics/rooms", input);
}
export function updateRoom(id: number, input: CreateRoomInput): Promise<Salle> {
  return api.put<Salle>(`/academics/rooms/${id}`, input);
}
export function setRoomAvailability(id: number, available: boolean): Promise<Salle> {
  return api.patch<Salle>(`/academics/rooms/${id}/availability`, undefined, { query: { available } });
}
export function deleteRoom(id: number): Promise<void> {
  return api.delete<void>(`/academics/rooms/${id}`);
}

// ── Subjects ──────────────────────────────────────────────────────────────--
export function listSubjects(): Promise<Matiere[]> {
  return api.get<Matiere[]>("/academics/subjects");
}
export function createSubject(label: string, coefficient: number, syllabus?: string): Promise<Matiere> {
  return api.post<Matiere>("/academics/subjects", undefined, { query: { label, coefficient, syllabus } });
}
export function updateSubject(id: number, label: string, coefficient: number, syllabus?: string): Promise<Matiere> {
  return api.put<Matiere>(`/academics/subjects/${id}`, undefined, { query: { label, coefficient, syllabus } });
}
export function deleteSubject(id: number): Promise<void> {
  return api.delete<void>(`/academics/subjects/${id}`);
}

// ── Génération automatique d'emploi du temps (selon disponibilités) ─────────────
export interface ProposedSlot {
  classId: number; subjectId: number; teacherId: number | null;
  day: string; startTime: string; endTime: string;
}
export interface TimetableProposal { slots: ProposedSlot[]; teachersWithoutAvailability: number[] }

/** Propose un emploi du temps à partir des disponibilités enseignants (sans nombre de séances). */
export function proposeTimetable(classIds: number[]): Promise<TimetableProposal> {
  return api.post<TimetableProposal>("/staff/timetable/propose", { classIds });
}

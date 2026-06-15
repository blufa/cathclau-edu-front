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
  specialization: string | null;
  hireDate: string | null;
  active: boolean;
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
}

export type UpdateTeacherInput = Omit<CreateTeacherInput, "userId">;

/** Class where the teacher is head teacher (academics ClassPublicInfo). */
export interface TeacherClassInfo {
  id: number;
  label: string;
  levelLabel: string | null;
}

/** A subject assignment of the teacher (academics ClassSubjectPublicInfo). */
export interface TeacherSubjectInfo {
  subjectId: number;
  coefficient: string;
  teacherId: number;
}

/** A timetable slot (academics ScheduleSlotPublicInfo). */
export interface TeacherScheduleSlot {
  id: number;
  classId: number;
  subjectId: number;
  teacherId: number;
  roomId: number | null;
  day: string;
  startTime: string;
  endTime: string;
}

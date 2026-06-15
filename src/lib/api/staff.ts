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

export function createTeacher(input: CreateTeacherInput): Promise<Teacher> {
  return api.post<Teacher>("/staff/teachers", input);
}

export function updateTeacher(id: number, input: UpdateTeacherInput): Promise<Teacher> {
  return api.put<Teacher>(`/staff/teachers/${id}`, input);
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

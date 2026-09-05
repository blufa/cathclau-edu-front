import { api } from "@/lib/api/client";
import type { Course, CoursePurchase, CourseResource, CourseResourceType } from "@/lib/types/courses";

export interface CreateCourseInput {
  classId: number;
  subjectLabel?: string | null;
  title: string;
  description?: string | null;
  price: number;
  thumbnailUrl?: string | null;
}
export type UpdateCourseInput = Partial<CreateCourseInput>;

export function listPublishedCourses(classId?: number | null): Promise<Course[]> {
  return api.get<Course[]>("/courses", { query: { classId: classId ?? undefined } });
}

export function listManagedCourses(classId?: number | null): Promise<Course[]> {
  return api.get<Course[]>("/courses/gestion", { query: { classId: classId ?? undefined } });
}

export function getCourse(id: number): Promise<Course> {
  return api.get<Course>(`/courses/${id}`);
}

export function createCourse(input: CreateCourseInput): Promise<Course> {
  return api.post<Course>("/courses", input);
}

export function updateCourse(id: number, input: UpdateCourseInput): Promise<Course> {
  return api.put<Course>(`/courses/${id}`, input);
}

export function publishCourse(id: number): Promise<Course> {
  return api.patch<Course>(`/courses/${id}/publier`);
}

export function unpublishCourse(id: number): Promise<Course> {
  return api.patch<Course>(`/courses/${id}/depublier`);
}

export function deleteCourse(id: number): Promise<void> {
  return api.delete<void>(`/courses/${id}`);
}

export interface AddResourceInput {
  type: CourseResourceType;
  title?: string | null;
  fileUrl: string;
  sortOrder?: number | null;
  durationSeconds?: number | null;
}

export function addCourseResource(courseId: number, input: AddResourceInput): Promise<CourseResource> {
  return api.post<CourseResource>(`/courses/${courseId}/ressources`, input);
}

export function listCourseResources(courseId: number): Promise<CourseResource[]> {
  return api.get<CourseResource[]>(`/courses/${courseId}/ressources`);
}

export function deleteCourseResource(resourceId: number): Promise<void> {
  return api.delete<void>(`/courses/ressources/${resourceId}`);
}

// ── Achat / accès (portail parent/élève) ──────────────────────────────────────

export function purchaseCourse(courseId: number, studentId?: number | null): Promise<CoursePurchase> {
  return api.post<CoursePurchase>(`/courses/${courseId}/achat`, studentId != null ? { studentId } : {});
}

export function myCoursePurchases(studentId?: number | null): Promise<CoursePurchase[]> {
  return api.get<CoursePurchase[]>("/courses/mes-achats", { query: { studentId: studentId ?? undefined } });
}

export function getCourseContent(courseId: number, studentId?: number | null): Promise<CourseResource[]> {
  return api.get<CourseResource[]>(`/courses/${courseId}/contenu`, { query: { studentId: studentId ?? undefined } });
}

export function listAllCoursePurchases(): Promise<CoursePurchase[]> {
  return api.get<CoursePurchase[]>("/courses/achats");
}

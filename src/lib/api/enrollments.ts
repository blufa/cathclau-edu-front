import { api } from "@/lib/api/client";
import type { Enrollment, EnrollInput, EnrollmentSearchParams } from "@/lib/types/student";

export function searchEnrollments(params: EnrollmentSearchParams): Promise<Enrollment[]> {
  return api.get<Enrollment[]>("/enrollments", {
    query: {
      studentId: params.studentId,
      classId: params.classId,
      academicYearId: params.academicYearId,
      status: params.status,
    },
  });
}

export function enroll(input: EnrollInput): Promise<Enrollment> {
  return api.post<Enrollment>("/enrollments", input);
}

export function reenroll(input: EnrollInput): Promise<Enrollment> {
  return api.post<Enrollment>("/enrollments/re-enrollment", input);
}

export function validateEnrollment(id: number): Promise<Enrollment> {
  return api.patch<Enrollment>(`/enrollments/${id}/validate`);
}

export function cancelEnrollment(id: number): Promise<Enrollment> {
  return api.patch<Enrollment>(`/enrollments/${id}/cancel`);
}

export function deleteEnrollment(id: number): Promise<void> {
  return api.delete<void>(`/enrollments/${id}`);
}

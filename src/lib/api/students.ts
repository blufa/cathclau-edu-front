import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type {
  CreateStudentInput,
  Student,
  StudentDetail,
  StudentSearchParams,
  UpdateStudentInput,
} from "@/lib/types/student";

export function searchStudents(params: StudentSearchParams): Promise<Page<Student>> {
  return api.get<Page<Student>>("/students", {
    query: {
      classId: params.classId,
      enrollmentStatus: params.enrollmentStatus,
      gender: params.gender,
      search: params.search || undefined,
      page: params.page,
      size: params.size,
      sort: params.sort,
    },
  });
}

export function getStudent(id: number): Promise<StudentDetail> {
  return api.get<StudentDetail>(`/students/${id}`);
}

export function createStudent(input: CreateStudentInput): Promise<Student> {
  return api.post<Student>("/students", input);
}

export function updateStudent(id: number, input: UpdateStudentInput): Promise<Student> {
  return api.put<Student>(`/students/${id}`, input);
}

export function deleteStudent(id: number): Promise<void> {
  return api.delete<void>(`/students/${id}`);
}

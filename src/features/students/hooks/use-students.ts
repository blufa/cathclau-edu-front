import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import type { CreateStudentInput, EnrollmentStatus, Gender, StudentSearchParams, UpdateStudentInput } from "@/lib/types/student";
import { createStudent, deleteStudent, getStudent, searchStudents, searchStudentsSummary, updateStudent } from "../api/students";

export function useStudentsQuery(params: StudentSearchParams) {
  return useQuery({
    queryKey: qk.students.list({ ...params }),
    queryFn: () => searchStudents(params),
  });
}

/** Élèves + classe courante + parent principal en un seul appel (liste élèves, guichet d'accueil). */
export function useStudentsSummaryQuery(params: {
  search?: string; gender?: Gender; enrollmentStatus?: EnrollmentStatus; notEnrolled?: boolean;
  transportSubscribed?: boolean; minPaidMonths?: number;
  page?: number; size?: number;
}, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...qk.students.list({ ...params }), "summary"],
    queryFn: () => searchStudentsSummary(params),
    enabled: options?.enabled ?? true,
  });
}

export function useStudentQuery(id: number) {
  return useQuery({
    queryKey: qk.students.detail(id),
    queryFn: () => getStudent(id),
  });
}

export function useCreateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateStudentInput) => createStudent(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.students.all }),
  });
}

export function useUpdateStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateStudentInput }) => updateStudent(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.students.all }),
  });
}

export function useDeleteStudentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteStudent(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.students.all }),
  });
}

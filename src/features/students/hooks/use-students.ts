import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import type { CreateStudentInput, StudentSearchParams, UpdateStudentInput } from "@/lib/types/student";
import { createStudent, deleteStudent, getStudent, searchStudents, updateStudent } from "../api/students";

export function useStudentsQuery(params: StudentSearchParams) {
  return useQuery({
    queryKey: qk.students.list({ ...params }),
    queryFn: () => searchStudents(params),
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

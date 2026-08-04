import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query";
import type { CreateClassInput } from "@/lib/types/academics";
import { createClass, deleteClass, getClass, listClasses, updateClass } from "../api/classes";

export function useClassesQuery(academicYearId: number | null) {
  return useQuery({
    queryKey: qk.classes.list({ academicYearId }),
    queryFn: () => listClasses(academicYearId as number),
    enabled: academicYearId != null,
  });
}

export function useClassQuery(id: number) {
  return useQuery({
    queryKey: qk.classes.detail(id),
    queryFn: () => getClass(id),
  });
}

export function useCreateClassMutation(academicYearId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateClassInput) => createClass(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.classes.list({ academicYearId }) }),
  });
}

export function useUpdateClassMutation(academicYearId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: CreateClassInput }) => updateClass(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.classes.list({ academicYearId }) }),
  });
}

export function useDeleteClassMutation(academicYearId: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteClass(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qk.classes.list({ academicYearId }) }),
  });
}

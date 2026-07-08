import { api } from "@/lib/api/client";
import type { Assignment, AssignmentInput, AssignmentStatus, AssignmentSubmission } from "@/lib/types/assignment";

export function listAssignments(params?: { classId?: number; status?: AssignmentStatus }): Promise<Assignment[]> {
  return api.get<Assignment[]>("/assignments", { query: { classId: params?.classId, status: params?.status } });
}

export function getAssignment(id: number): Promise<Assignment> {
  return api.get<Assignment>(`/assignments/${id}`);
}

export function createAssignment(input: AssignmentInput): Promise<Assignment> {
  return api.post<Assignment>("/assignments", input);
}

export function updateAssignment(id: number, input: AssignmentInput): Promise<Assignment> {
  return api.put<Assignment>(`/assignments/${id}`, input);
}

export function closeAssignment(id: number): Promise<Assignment> {
  return api.patch<Assignment>(`/assignments/${id}/close`);
}

export function reopenAssignment(id: number): Promise<Assignment> {
  return api.patch<Assignment>(`/assignments/${id}/reopen`);
}

export function deleteAssignment(id: number): Promise<void> {
  return api.delete<void>(`/assignments/${id}`);
}

export function listSubmissions(assignmentId: number): Promise<AssignmentSubmission[]> {
  return api.get<AssignmentSubmission[]>(`/assignments/${assignmentId}/submissions`);
}

export function submitAssignment(assignmentId: number, input: { studentId: number; fileUrl?: string | null }): Promise<AssignmentSubmission> {
  return api.post<AssignmentSubmission>(`/assignments/${assignmentId}/submissions`, input);
}

export function gradeSubmission(submissionId: number, input: { grade?: number | null; feedback?: string | null }): Promise<AssignmentSubmission> {
  return api.patch<AssignmentSubmission>(`/assignments/submissions/${submissionId}/grade`, input);
}

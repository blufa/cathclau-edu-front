export type AssignmentStatus = "OPEN" | "CLOSED";
export type SubmissionStatus = "SUBMITTED" | "LATE" | "GRADED";

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  OPEN: "Ouvert",
  CLOSED: "Clôturé",
};

export const SUBMISSION_STATUS_LABEL: Record<SubmissionStatus, string> = {
  SUBMITTED: "Remis",
  LATE: "En retard",
  GRADED: "Noté",
};

export interface Assignment {
  id: number;
  classId: number;
  subjectId: number;
  teacherId: number | null;
  title: string;
  instructions: string | null;
  attachmentUrl: string | null;
  dueDate: string | null;
  maxScore: number | null;
  status: AssignmentStatus;
  createdAt: string | null;
}

export interface AssignmentSubmission {
  id: number;
  assignmentId: number;
  studentId: number;
  submittedAt: string | null;
  status: SubmissionStatus;
  fileUrl: string | null;
  grade: number | null;
  feedback: string | null;
}

export interface AssignmentInput {
  classId: number;
  subjectId: number;
  teacherId?: number | null;
  title: string;
  instructions?: string | null;
  attachmentUrl?: string | null;
  dueDate?: string | null;
  maxScore?: number | null;
}

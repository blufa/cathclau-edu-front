import { api } from "@/lib/api/client";
import type { Student } from "@/lib/types/student";

/** Parent/student portal — resolution of the authenticated user to their records. */

/** The children (students) of the currently authenticated parent. */
export function getMyChildren(): Promise<Student[]> {
  return api.get<Student[]>("/parents/me/children");
}

/** The student record of the currently authenticated student user. */
export function getMyStudent(): Promise<Student> {
  return api.get<Student>("/students/me");
}

// ── Portail parent (§B1) : tableau de bord, annonces, documents, reçus ───────
export interface ParentChildSummary {
  studentId: number;
  firstName: string | null;
  lastName: string | null;
  className: string | null;
  overallAverage: string | null;
  rank: number | null;
  mention: string | null;
  feesRemaining: string | null;
}

export interface ParentDashboard {
  childrenCount: number;
  children: ParentChildSummary[];
}

export interface ParentAnnouncement {
  id: number;
  title: string;
  content: string;
  scope: string;
  authorName: string | null;
  publishedAt: string | null;
}

export interface ParentDocumentItem {
  type: string;
  id: number;
  label: string;
  downloadUrl: string | null;
}

export function getParentDashboard(): Promise<ParentDashboard> {
  return api.get<ParentDashboard>("/parent/dashboard");
}

export function getParentAnnouncements(): Promise<ParentAnnouncement[]> {
  return api.get<ParentAnnouncement[]>("/parent/announcements");
}

export function getChildDocuments(studentId: number): Promise<ParentDocumentItem[]> {
  return api.get<ParentDocumentItem[]>(`/parent/children/${studentId}/documents`);
}

export function getParentReceiptPdfObjectUrl(receiptId: number): Promise<string> {
  return api.blobUrl(`/parent/receipts/${receiptId}/pdf/download`);
}

// ── Annuaire des contacts (enseignants de la classe, direction) ──────────────
export interface TeacherContact {
  teacherId: number;
  fullName: string;
  phone: string | null;
  subject: string;
}
export interface ChildContacts {
  studentId: number;
  firstName: string | null;
  lastName: string | null;
  className: string | null;
  teachers: TeacherContact[];
}
export interface LeadershipContact {
  fullName: string;
  phone: string | null;
  role: string;
}
export interface ParentContacts {
  children: ChildContacts[];
  leadership: LeadershipContact[];
}

/** Contacts joignables de l'établissement : enseignants de la classe de chaque enfant, et direction
 * (directeur, responsable pédagogique). */
export function getParentContacts(): Promise<ParentContacts> {
  return api.get<ParentContacts>("/parent/contacts");
}

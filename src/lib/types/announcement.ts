/** Announcement contracts mirrored from the backend announcements module. */

export type AnnouncementScope = "GENERAL" | "CLASS" | "STUDENT";

export const ANNOUNCEMENT_SCOPE_LABEL: Record<AnnouncementScope, string> = {
  GENERAL: "Générale",
  CLASS: "Classe",
  STUDENT: "Élève",
};

export interface Announcement {
  id: number;
  tenantId: number | null;
  title: string;
  content: string;
  scope: AnnouncementScope;
  classId: number | null;
  studentId: number | null;
  authorId: number | null;
  authorName: string | null;
  publishedAt: string | null;
  createdAt: string | null;
}

export interface AnnouncementInput {
  title: string;
  content: string;
  scope: AnnouncementScope;
  classId?: number | null;
  studentId?: number | null;
  authorName?: string | null;
}

export interface AnnouncementUpdate {
  title: string;
  content: string;
}

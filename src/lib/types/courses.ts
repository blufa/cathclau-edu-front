/** Contrats du module cours (§16 B) — cours vidéo/PDF payants par classe. */

export type CourseResourceType = "VIDEO" | "PDF";
export type CoursePurchaseStatus = "PENDING" | "PAID";

export interface Course {
  id: number;
  tenantId: number;
  classId: number;
  subjectLabel: string | null;
  title: string;
  description: string | null;
  price: string;
  thumbnailUrl: string | null;
  schoolFeeId: number;
  published: boolean;
  createdAt: string | null;
}

export interface CourseResource {
  id: number;
  courseId: number;
  type: CourseResourceType;
  title: string | null;
  /** Nul tant que l'élève n'a pas payé le cours — aperçu verrouillé. */
  fileUrl: string | null;
  sortOrder: number | null;
  durationSeconds: number | null;
}

export interface CoursePurchase {
  id: number;
  tenantId: number;
  studentId: number;
  courseId: number;
  invoiceId: number;
  status: CoursePurchaseStatus;
  createdAt: string | null;
  purchasedAt: string | null;
}

import { api } from "@/lib/api/client";
import type { Page } from "@/lib/api/types";
import type {
  CreateStudentInput,
  EnrollmentStatus,
  Gender,
  Student,
  StudentDetail,
  StudentDocument,
  StudentSearchParams,
  StudentSummary,
  UpdateStudentInput,
} from "@/lib/types/student";

export type DocumentType = "BIRTH_CERTIFICATE" | "PHOTO" | "MEDICAL_CERTIFICATE" | "ACADEMIC_RECORD";
export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  BIRTH_CERTIFICATE: "Acte de naissance",
  PHOTO: "Photo",
  MEDICAL_CERTIFICATE: "Certificat médical",
  ACADEMIC_RECORD: "Bulletin / dossier scolaire",
};

/** La fiche élève de l'utilisateur connecté (portail élève). */
export function getMyStudent(): Promise<Student> {
  return api.get<Student>("/students/me");
}

/** L'élève connecté met à jour ses propres coordonnées (jamais matricule/état civil). */
export function updateMyStudentProfile(input: { phone?: string | null; email?: string | null; address?: string | null }): Promise<Student> {
  return api.put<Student>("/students/me", input);
}

export function updateMyStudentPhoto(photoUrl: string): Promise<Student> {
  return api.patch<Student>("/students/me/photo", undefined, { query: { photoUrl } });
}

export function searchStudents(params: StudentSearchParams): Promise<Page<Student>> {
  return api.get<Page<Student>>("/students", {
    query: {
      classId: params.classId,
      enrollmentStatus: params.enrollmentStatus,
      notEnrolled: params.notEnrolled || undefined,
      gender: params.gender,
      search: params.search || undefined,
      page: params.page,
      size: params.size,
      sort: params.sort,
    },
  });
}

/** Liste des élèves avec classe courante + parent principal (guichet d'accueil, liste élèves), triée
 * alphabétiquement (nom, ascendant). `transportSubscribed`/`minPaidMonths` filtrent par abonnement
 * transport et nombre de mois de transport payés (§retour comptable : "filtrer par transport, pour
 * chercher rapidement") — `minPaidMonths = 0` signifie "aucun mois payé" (égalité exacte), toute
 * autre valeur signifie "au moins N mois payés". */
export function searchStudentsSummary(params: {
  search?: string; gender?: Gender; enrollmentStatus?: EnrollmentStatus; notEnrolled?: boolean;
  classId?: number;
  page?: number; size?: number;
}): Promise<Page<StudentSummary>> {
  return api.get<Page<StudentSummary>>("/students/summary", {
    query: {
      search: params.search || undefined, gender: params.gender,
      enrollmentStatus: params.enrollmentStatus, notEnrolled: params.notEnrolled || undefined,
      classId: params.classId,
      page: params.page, size: params.size, sort: "lastName,asc",
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

export function updateStudentPhoto(id: number, photoUrl: string): Promise<Student> {
  return api.patch<Student>(`/students/${id}/photo`, undefined, { query: { photoUrl } });
}

export function deleteStudent(id: number): Promise<void> {
  return api.delete<void>(`/students/${id}`);
}

export interface StudentPurgeResult {
  studentId: number;
  deletedByTable: Record<string, number>;
  warnings: string[];
}

/** Purge DÉFINITIVE (irréversible, SUPER_ADMIN) : supprime l'élève et toutes les lignes qui le
 * référencent (factures, paiements, inscriptions/réinscriptions, présences, notes…) — contrairement
 * à `deleteStudent` ci-dessus, qui ne fait qu'archiver (réversible, ne touche à rien d'autre). */
export function purgeStudent(id: number): Promise<StudentPurgeResult> {
  return api.delete<StudentPurgeResult>(`/students/${id}/purge`);
}

// ── Documents ──────────────────────────────────────────────────────────────
export function getStudentDocuments(studentId: number): Promise<StudentDocument[]> {
  return api.get<StudentDocument[]>(`/students/${studentId}/documents`);
}
export function addStudentDocument(studentId: number, documentType: DocumentType, fileUrl: string): Promise<StudentDocument> {
  return api.post<StudentDocument>(`/students/${studentId}/documents`, { documentType, fileUrl });
}
export function deleteStudentDocument(studentId: number, documentId: number): Promise<void> {
  return api.delete<void>(`/students/${studentId}/documents/${documentId}`);
}

// ── Transfer certificate (certificat de radiation/transfert) ─────────────────
export function generateTransferCertificate(studentId: number, body: { schoolName?: string; motif?: string }): Promise<{ url: string }> {
  return api.post<{ url: string }>(`/students/${studentId}/certificat-radiation`, body);
}

// ── Bulk CSV import ──────────────────────────────────────────────────────────
export interface ImportReport {
  total: number;
  created: number;
  errors: { line: number; message: string }[];
}
export async function importStudentsCsv(file: File): Promise<ImportReport> {
  const { getAccessToken } = await import("@/lib/auth/tokens");
  const { getImpersonatedTenantId } = await import("@/lib/auth/impersonation");
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8284/api/v1";
  const form = new FormData();
  form.append("file", file);
  const headers = new Headers();
  const token = getAccessToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const imp = getImpersonatedTenantId();
  if (imp != null) headers.set("X-Tenant-Id", String(imp));
  const res = await fetch(`${base}/students/import`, { method: "POST", headers, body: form });
  if (!res.ok) {
    let detail = "Échec de l'import";
    try { const j = await res.json(); detail = j.detail ?? j.message ?? detail; } catch { /* ignore */ }
    throw new Error(detail);
  }
  return (await res.json()) as ImportReport;
}

/** Un créneau d'emploi du temps (vue publique) pour le portail élève/parent. */
export interface StudentScheduleSlot {
  id: number;
  classId: number;
  subjectId: number | null;
  teacherId: number | null;
  roomId: number | null;
  day: string;
  startTime: string;
  endTime: string;
  label: string | null;
}

/** Emploi du temps de la classe courante d'un élève. */
export function getStudentSchedule(studentId: number): Promise<StudentScheduleSlot[]> {
  return api.get<StudentScheduleSlot[]>(`/students/${studentId}/emploi-du-temps`);
}

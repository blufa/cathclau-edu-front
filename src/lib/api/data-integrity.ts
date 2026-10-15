import { api } from "@/lib/api/client";

export interface HeadcountMismatch {
  classId: number;
  className: string;
  cachedHeadcount: number;
  actualValidatedEnrollments: number;
}

export interface OrphanedInvoice {
  invoiceId: number;
  studentId: number;
  reference: string;
  remainingBalance: string;
}

export interface OrphanedPayment {
  paymentId: number;
  studentId: number;
  reference: string;
  amount: string;
}

export interface OrphanRowGroup {
  table: string;
  studentId: number;
  rowCount: number;
}

export interface DataIntegrityScanResult {
  headcountMismatches: HeadcountMismatch[];
  orphanedInvoices: OrphanedInvoice[];
  orphanedPayments: OrphanedPayment[];
  /** Mêmes ~19 tables que l'outil de purge élève (bulletins, notes, présences...), groupées par
   * (table, ancien student_id) — scopées à l'école impersonnée. */
  orphanedOtherTables: OrphanRowGroup[];
  /** `student_documents` n'a ni tenant_id ni colonne de repli : scanné hors scope tenant, visible
   * quelle que soit l'école impersonnée (voir DataIntegrityService côté backend). */
  orphanedStudentDocuments: OrphanRowGroup[];
}

/** Libellés lisibles pour les tables techniques renvoyées par le scan — ordre d'affichage cohérent
 * avec StudentPurgeService (factures/paiements déjà affichés à part, non repris ici). */
export const ORPHAN_TABLE_LABEL: Record<string, string> = {
  report_cards: "Bulletins",
  exemptions: "Exonérations",
  grades: "Notes",
  grade_history: "Historique des notes",
  assignment_submissions: "Devoirs rendus",
  discipline_incidents: "Incidents disciplinaires",
  transport_subscriptions: "Abonnements transport",
  health_records: "Dossiers santé",
  infirmary_visits: "Visites infirmerie",
  announcements: "Annonces",
  scheduled_broadcasts: "Diffusions programmées",
  student_checkins: "Pointages élève",
  child_pickups: "Récupérations enfant",
  course_purchases: "Achats de cours",
  student_card: "Cartes élève",
  student_attendances: "Présences",
  student_parents: "Liens parent-élève",
  enrollments: "Inscriptions",
  student_documents: "Documents élève",
};

export function deleteOrphanedRows(table: string, studentId: number): Promise<void> {
  return api.delete<void>(`/students/data-integrity/tables/${table}/students/${studentId}`);
}

/** Vérification de la cohérence des données de l'école impersonnée (§retour utilisateur — suppressions
 * manuelles en base, hors de l'application) — réservé SUPER_ADMIN, voir DataIntegrityService côté
 * backend. Scopé par le tenant actuellement impersonné (header X-Tenant-Id). */
export function scanDataIntegrity(): Promise<DataIntegrityScanResult> {
  return api.get<DataIntegrityScanResult>("/students/data-integrity/scan");
}

export function fixHeadcount(classId: number): Promise<{ headcount: number }> {
  return api.post<{ headcount: number }>(`/students/data-integrity/headcount/${classId}/fix`, {});
}

export function deleteOrphanedInvoice(invoiceId: number): Promise<void> {
  return api.delete<void>(`/students/data-integrity/invoices/${invoiceId}`);
}

export function deleteOrphanedPayment(paymentId: number): Promise<void> {
  return api.delete<void>(`/students/data-integrity/payments/${paymentId}`);
}

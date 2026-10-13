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

export interface DataIntegrityScanResult {
  headcountMismatches: HeadcountMismatch[];
  orphanedInvoices: OrphanedInvoice[];
  orphanedPayments: OrphanedPayment[];
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

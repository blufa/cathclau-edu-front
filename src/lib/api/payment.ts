import { api } from "@/lib/api/client";
import type {
  DjomyStatusResponse,
  InitiatePaymentInput,
  InitiatePaymentResponse,
  Payment,
  PaymentChannel,
  PaymentProvider,
  PaymentTransaction,
  Receipt,
} from "@/lib/types/payment";

/** Passer academicYearId pour ne voir que les paiements de l'année scolaire choisie (recommandé —
 * sans ce filtre, tous les paiements de toutes les années créées se mélangent). */
export function listPaymentsByTenant(tenantId: number, academicYearId?: number | null): Promise<Payment[]> {
  return api.get<Payment[]>(`/payments/tenant/${tenantId}`, { query: { academicYearId: academicYearId ?? undefined } });
}

export function listPaymentsByInvoice(invoiceId: number): Promise<Payment[]> {
  return api.get<Payment[]>(`/payments/invoice/${invoiceId}`);
}

export function listPaymentsByStudent(studentId: number): Promise<Payment[]> {
  return api.get<Payment[]>(`/payments/student/${studentId}`);
}

export function initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResponse> {
  return api.post<InitiatePaymentResponse>("/payments", input);
}

export interface GroupPaymentInput {
  tenantId: number | null;
  /** Élève principal (premier enfant pour un paiement groupé multi-enfants, §payments — fratrie). */
  studentId: number;
  channel: PaymentChannel;
  payerNumber?: string | null;
  coverageLabel: string;
  monthsCount: number;
  remainingAfter: number;
  /** studentId par part optionnel — nécessaire seulement quand les factures appartiennent à des
   * élèves différents (encaissement multi-enfants) ; sinon retombe sur le studentId principal.
   * paidMonths : mois "YYYY-MM" cochés pour cette part sur une facture multi-mois (tranche) —
   * reportés sur Invoice.paidMonths pour que la facture reflète les mois réellement réglés. */
  shares: { invoiceId: number; studentId?: number; amount: number; paidMonths?: string[] }[];
  academicYearId?: number | null;
  /** Clé d'idempotence (mode hors-ligne, lib/offline/) : rejouer avec la même clé après une coupure
   * réseau renvoie le paiement déjà créé côté serveur au lieu d'en créer un second. */
  idempotencyKey?: string;
}

/**
 * Group payment of several months (or the whole year) — one payment, one receipt.
 * Desk channels are immediate; Djomy returns a redirectUrl for a single online transaction.
 */
export function initiateGroupPayment(input: GroupPaymentInput): Promise<InitiatePaymentResponse> {
  return api.post<InitiatePaymentResponse>("/payments/group", input);
}

/** Confirm a school payment by polling Djomy on demand (no webhook); activates/splits on success. */
export function confirmSchoolPaymentViaDjomy(paymentId: number): Promise<Payment> {
  return api.post<Payment>(`/payments/${paymentId}/confirm-djomy`);
}

/** Self-service online payment initiated by a parent/student (online channels only — no cash). */
export function initiateSelfServicePayment(input: InitiatePaymentInput): Promise<InitiatePaymentResponse> {
  return api.post<InitiatePaymentResponse>("/payments/self-service", input);
}

export function confirmPaymentSuccess(id: number): Promise<Payment> {
  return api.put<Payment>(`/payments/${id}/success`);
}

export function markPaymentFailed(id: number): Promise<Payment> {
  return api.put<Payment>(`/payments/${id}/fail`);
}

export function refundPayment(id: number): Promise<Payment> {
  return api.put<Payment>(`/payments/${id}/refund`);
}

/** Returns { url } when ready, or { status: "GENERATING" } (HTTP 202) while generating. */
/** Flux PDF du reçu servi par le backend (object URL local) — indépendant de Cloudinary. */
export function getReceiptPdfObjectUrl(paymentId: number): Promise<string> {
  return api.blobUrl(`/payments/${paymentId}/receipt/pdf/download`);
}

export function getPaymentReceiptPdf(id: number): Promise<{ url?: string; status?: string }> {
  return api.get<{ url?: string; status?: string }>(`/payments/${id}/receipt/pdf`);
}

export function getPayment(id: number): Promise<Payment> {
  return api.get<Payment>(`/payments/${id}`);
}

export function getPaymentByReference(reference: string): Promise<Payment> {
  return api.get<Payment>(`/payments/reference/${encodeURIComponent(reference)}`);
}

export function getPaymentDjomyStatus(id: number): Promise<DjomyStatusResponse> {
  return api.get<DjomyStatusResponse>(`/payments/${id}/djomy-status`);
}

export function getPaymentTransactions(id: number): Promise<PaymentTransaction[]> {
  return api.get<PaymentTransaction[]>(`/payments/${id}/transactions`);
}

// ── Transactions fournisseur ─────────────────────────────────────────────────
export function listTransactions(params?: {
  provider?: PaymentProvider;
  paymentId?: number;
}): Promise<PaymentTransaction[]> {
  return api.get<PaymentTransaction[]>("/payments/transactions", { query: params });
}

export function getTransaction(id: number): Promise<PaymentTransaction> {
  return api.get<PaymentTransaction>(`/payments/transactions/${id}`);
}

// ── Reçus (module payments) ──────────────────────────────────────────────────
export function listReceipts(studentId?: number): Promise<Receipt[]> {
  return api.get<Receipt[]>("/payments/receipts", { query: { studentId } });
}

export function getReceipt(id: number): Promise<Receipt> {
  return api.get<Receipt>(`/payments/receipts/${id}`);
}

export function getReceiptByPayment(paymentId: number): Promise<Receipt> {
  return api.get<Receipt>(`/payments/receipts/payment/${paymentId}`);
}

export function getReceiptByReference(reference: string): Promise<Receipt> {
  return api.get<Receipt>(`/payments/receipts/reference/${encodeURIComponent(reference)}`);
}

export function generateReceipt(paymentId: number): Promise<Receipt> {
  return api.post<Receipt>(`/payments/receipts/payment/${paymentId}`);
}

export function getReceiptPdf(id: number): Promise<{ url?: string; status?: string }> {
  return api.get<{ url?: string; status?: string }>(`/payments/receipts/${id}/pdf`);
}

export function getReceiptPdfObjectUrlById(id: number): Promise<string> {
  return api.blobUrl(`/payments/receipts/${id}/pdf/download`);
}

import { api } from "@/lib/api/client";
import type {
  ApplicableDiscount,
  ClassTransferRefund,
  EarlyPaymentDiscountRule,
  EarlyPaymentDiscountRuleInput,
  Exemption,
  ExemptionInput,
  ExemptionRule,
  ExemptionRuleInput,
  FamilyDiscountRule,
  FamilyDiscountRuleInput,
  FeeType,
  GenerateAllFeesInput,
  GeneratedFeeInvoices,
  GenerateMonthlyResult,
  Installment,
  InstallmentInput,
  Invoice,
  InvoiceStatus,
  SchoolFee,
  SchoolFeeInput,
  StaffChildBenefitPolicy,
  StaffChildBenefitPolicyInput,
  StaffCoverage,
  StudentCoverage,
} from "@/lib/types/billing";

// ── School fees ──────────────────────────────────────────────────────────
export function listFeesByTenant(tenantId: number): Promise<SchoolFee[]> {
  return api.get<SchoolFee[]>(`/billing/fees/tenant/${tenantId}`);
}

export function listFeesByClass(classId: number): Promise<SchoolFee[]> {
  return api.get<SchoolFee[]>(`/billing/fees/class/${classId}`);
}

export function listFeesByRoute(routeId: number): Promise<SchoolFee[]> {
  return api.get<SchoolFee[]>(`/billing/fees/route/${routeId}`);
}

export function createFee(input: SchoolFeeInput): Promise<SchoolFee> {
  return api.post<SchoolFee>("/billing/fees", input);
}

export function updateFee(id: number, input: Omit<SchoolFeeInput, "tenantId">): Promise<SchoolFee> {
  return api.put<SchoolFee>(`/billing/fees/${id}`, input);
}

export function deleteFee(id: number): Promise<void> {
  return api.delete<void>(`/billing/fees/${id}`);
}

// ── Installments ─────────────────────────────────────────────────────────
export function listInstallments(feeId: number): Promise<Installment[]> {
  return api.get<Installment[]>(`/billing/installments/fee/${feeId}`);
}

export function createInstallment(feeId: number, input: InstallmentInput): Promise<Installment> {
  return api.post<Installment>("/billing/installments", { feeId, ...input });
}

/** Génère des échéances trimestrielles pondérées (ex. 40/30/30) depuis un total annuel. */
export function generateWeightedTerms(feeId: number, annualTotal: number, terms: { label: string; percentage: number; dueDate?: string | null }[]): Promise<Installment[]> {
  return api.post<Installment[]>("/billing/installments/generate-terms", { feeId, annualTotal, terms });
}

export function deleteInstallment(id: number): Promise<void> {
  return api.delete<void>(`/billing/installments/${id}`);
}

/** Déclenche immédiatement la vérification des échéances en retard (même traitement que le job
 * planifié quotidien de 6h) — pour tester une relance sans attendre le lendemain matin. */
export function checkOverdueInstallmentsNow(): Promise<void> {
  return api.post<void>("/billing/installments/check-overdue-now");
}

/** Applique une remise / bourse (montant + motif) à une facture. */
export function applyInvoiceDiscount(id: number, amount: number, reason: string): Promise<Invoice> {
  return api.patch<Invoice>(`/billing/invoices/${id}/discount`, { amount, reason });
}

/** Avance le recouvrement d'une étape (relance 1 → relance 2 → exclusion). */
export function advanceRecovery(id: number): Promise<Invoice> {
  return api.patch<Invoice>(`/billing/invoices/${id}/recovery/advance`);
}

/** Positionne directement l'étape de recouvrement. */
export function setRecoveryStage(id: number, stage: import("@/lib/types/billing").RecoveryStage): Promise<Invoice> {
  return api.patch<Invoice>(`/billing/invoices/${id}/recovery`, undefined, { query: { stage } });
}

// ── Invoices ─────────────────────────────────────────────────────────────
/** Passer academicYearId pour ne voir que les factures de l'année scolaire choisie (recommandé —
 * sans ce filtre, toutes les factures de toutes les années créées se mélangent). */
export function listInvoicesByTenant(tenantId: number, academicYearId?: number | null): Promise<Invoice[]> {
  return api.get<Invoice[]>(`/billing/invoices/tenant/${tenantId}`, { query: { academicYearId: academicYearId ?? undefined } });
}

export function listInvoicesByStatus(tenantId: number, status: InvoiceStatus): Promise<Invoice[]> {
  return api.get<Invoice[]>(`/billing/invoices/tenant/${tenantId}/status/${status}`);
}

export function listInvoicesByStudent(studentId: number): Promise<Invoice[]> {
  return api.get<Invoice[]>(`/billing/invoices/student/${studentId}`);
}

/** Récupère (ou génère à la demande) l'URL du PDF de la facture. */
export function getInvoicePdf(id: number): Promise<{ url?: string }> {
  return api.get<{ url?: string }>(`/billing/invoices/${id}/pdf`);
}

/** Flux PDF de la facture servi par le backend (object URL local) — indépendant de Cloudinary. */
export function getInvoicePdfObjectUrl(id: number): Promise<string> {
  return api.blobUrl(`/billing/invoices/${id}/pdf/download`);
}

export function createInvoice(input: {
  tenantId?: number | null;
  studentId: number;
  feeId: number;
  reference: string;
  totalAmount: number;
  academicYearId?: number | null;
}): Promise<Invoice> {
  return api.post<Invoice>("/billing/invoices", input);
}

/** Facture un frais annexe (cantine, examen, autre…) déjà configuré pour la classe mais pas encore
 * facturé à l'élève — même mécanisme que « Ajouter un frais annexe » à l'encaissement, réutilisable
 * ailleurs (ex. à l'inscription pour abonner un élève à la cantine). */
export function subscribeAnnexFee(
  tenantId: number | null,
  studentId: number,
  fee: SchoolFee,
  academicYearId: number | null,
): Promise<Invoice> {
  return createInvoice({
    tenantId, studentId, feeId: fee.id,
    reference: `EC-${fee.type}-${Date.now().toString(36).toUpperCase()}`,
    totalAmount: Number(fee.amount),
    academicYearId,
  });
}

export function generateInvoicesBulk(tenantId: number | null, classId: number, feeId: number, academicYearId?: number | null): Promise<Invoice[]> {
  return api.post<Invoice[]>("/billing/invoices/generate-bulk", { tenantId, classId, feeId, academicYearId });
}

/** Génère en un seul appel toutes les factures des frais rattachés à la classe d'un élève, à
 * l'inscription (§retour comptable, refonte inscription) — inscription, mensualités, cantine,
 * examen... + transport si choisi. N'applique aucune remise ici : déjà fait côté serveur. */
export function generateAllForEnrollment(input: GenerateAllFeesInput): Promise<GeneratedFeeInvoices[]> {
  return api.post<GeneratedFeeInvoices[]>("/billing/enrollment-billing/generate-all", input);
}

/** Génère une facture par mois (échéance) d'un frais MENSUALITE pour un élève — les échéances
 * couvertes à 100% par une exonération n'ont pas de facture créée, voir `exemptedPeriods`. */
export function generateMonthlyInvoices(tenantId: number | null, studentId: number, feeId: number, academicYearId?: number | null): Promise<GenerateMonthlyResult> {
  return api.post<GenerateMonthlyResult>("/billing/invoices/generate-monthly", { tenantId, studentId, feeId, academicYearId });
}

/** Génère uniquement les échéances choisies (un ou plusieurs mois, cochés par le comptable) au lieu de
 * toutes comme `generateMonthlyInvoices` — sert au transport (§billing), facturé au mois, à la demande,
 * jamais à l'avance pour toute l'année. Idempotent : une échéance déjà facturée est ignorée sans erreur. */
export function generateSelectedInstallments(tenantId: number | null, studentId: number, feeId: number, installmentIds: number[], academicYearId?: number | null): Promise<GenerateMonthlyResult> {
  return api.post<GenerateMonthlyResult>("/billing/invoices/generate-selected-installments", { tenantId, studentId, feeId, academicYearId, installmentIds });
}

export function applyInvoicePayment(id: number, amount: number): Promise<Invoice> {
  return api.put<Invoice>(`/billing/invoices/${id}/payment`, { amount });
}

export function cancelInvoice(id: number): Promise<void> {
  return api.delete<void>(`/billing/invoices/${id}/cancel`);
}

/** Suppression physique — uniquement si la facture n'a encore reçu aucun paiement (§retour
 * comptable, refonte inscription). Utiliser {@link cancelInvoice} sinon (garde l'historique). */
export function deleteInvoice(id: number): Promise<void> {
  return api.delete<void>(`/billing/invoices/${id}`);
}

export function getInvoiceByReference(reference: string): Promise<Invoice> {
  return api.get<Invoice>(`/billing/invoices/reference/${encodeURIComponent(reference)}`);
}

// ── Exemptions (exonérations de frais) ───────────────────────────────────────
export function listExemptions(): Promise<Exemption[]> {
  return api.get<Exemption[]>("/billing/exemptions");
}
export function listExemptionsByStudent(studentId: number): Promise<Exemption[]> {
  return api.get<Exemption[]>(`/billing/exemptions/student/${studentId}`);
}
export function grantExemption(input: ExemptionInput): Promise<Exemption> {
  return api.post<Exemption>("/billing/exemptions", input);
}
export function revokeExemption(id: number): Promise<Exemption> {
  return api.patch<Exemption>(`/billing/exemptions/${id}/revoquer`);
}

// ── Surplus de transfert de classe (§retour comptable : à rembourser au parent) ─────────────
export function listClassTransferRefunds(studentId: number): Promise<ClassTransferRefund[]> {
  return api.get<ClassTransferRefund[]>(`/billing/class-transfer-refunds/student/${studentId}`);
}
export function markClassTransferRefundRefunded(id: number): Promise<ClassTransferRefund> {
  return api.patch<ClassTransferRefund>(`/billing/class-transfer-refunds/${id}/rembourse`);
}

// ── Types d'exonération pré-configurés (catalogue réutilisable) ──────────────
export function listExemptionRules(): Promise<ExemptionRule[]> {
  return api.get<ExemptionRule[]>("/billing/exemption-rules");
}
export function createExemptionRule(input: ExemptionRuleInput): Promise<ExemptionRule> {
  return api.post<ExemptionRule>("/billing/exemption-rules", input);
}
export function updateExemptionRule(id: number, input: ExemptionRuleInput): Promise<ExemptionRule> {
  return api.put<ExemptionRule>(`/billing/exemption-rules/${id}`, input);
}
export function deleteExemptionRule(id: number): Promise<void> {
  return api.delete<void>(`/billing/exemption-rules/${id}`);
}

// ── Staff child benefit policies ─────────────────────────────────────────────
export function listStaffChildBenefits(): Promise<StaffChildBenefitPolicy[]> {
  return api.get<StaffChildBenefitPolicy[]>("/billing/staff-child-benefits");
}
export function createStaffChildBenefit(input: StaffChildBenefitPolicyInput): Promise<StaffChildBenefitPolicy> {
  return api.post<StaffChildBenefitPolicy>("/billing/staff-child-benefits", input);
}
export function updateStaffChildBenefit(id: number, input: StaffChildBenefitPolicyInput): Promise<StaffChildBenefitPolicy> {
  return api.put<StaffChildBenefitPolicy>(`/billing/staff-child-benefits/${id}`, input);
}
export function deleteStaffChildBenefit(id: number): Promise<void> {
  return api.delete<void>(`/billing/staff-child-benefits/${id}`);
}
export function getStaffChildCoverage(studentId: number, feeType: FeeType): Promise<StaffCoverage> {
  return api.get<StaffCoverage>("/billing/staff-child-benefits/coverage", { query: { studentId, feeType } });
}
/** Parmi `studentIds`, ceux pris en charge (enfants de personnel) pour un frais (badge liste des élèves). */
export function getStaffChildCoverageBatch(studentIds: number[], feeType: FeeType): Promise<StudentCoverage[]> {
  if (studentIds.length === 0) return Promise.resolve([]);
  return api.get<StudentCoverage[]>("/billing/staff-child-benefits/coverage-batch", { query: { studentIds: studentIds.join(","), feeType } });
}
/** Parmi `studentIds`, ceux enfants du personnel SANS aucune remise — scolarité prélevée automatiquement
 * sur le salaire du parent (badge distinct de {@link getStaffChildCoverageBatch} dans la liste des élèves). */
export function getUncoveredStaffChildIds(studentIds: number[]): Promise<number[]> {
  if (studentIds.length === 0) return Promise.resolve([]);
  return api.get<number[]>("/billing/staff-child-benefits/uncovered-batch", { query: { studentIds: studentIds.join(",") } });
}

// ── Family discount rules (remise fratrie) ───────────────────────────────────
export function listFamilyDiscountRules(): Promise<FamilyDiscountRule[]> {
  return api.get<FamilyDiscountRule[]>("/billing/family-discount-rules");
}
export function createFamilyDiscountRule(input: FamilyDiscountRuleInput): Promise<FamilyDiscountRule> {
  return api.post<FamilyDiscountRule>("/billing/family-discount-rules", input);
}
export function updateFamilyDiscountRule(id: number, input: FamilyDiscountRuleInput): Promise<FamilyDiscountRule> {
  return api.put<FamilyDiscountRule>(`/billing/family-discount-rules/${id}`, input);
}
export function deleteFamilyDiscountRule(id: number): Promise<void> {
  return api.delete<void>(`/billing/family-discount-rules/${id}`);
}
export function getApplicableFamilyDiscount(studentId: number, feeType: FeeType): Promise<ApplicableDiscount> {
  return api.get<ApplicableDiscount>("/billing/family-discount-rules/applicable", { query: { studentId, feeType } });
}
/** Parmi `studentIds`, ceux qui sont le cadet exonéré d'une fratrie nombreuse (badge liste des élèves). */
export function getEligibleYoungestStudentIds(studentIds: number[]): Promise<number[]> {
  if (studentIds.length === 0) return Promise.resolve([]);
  return api.get<number[]>("/billing/family-discount-rules/eligible-youngest", { query: { studentIds: studentIds.join(",") } });
}

// ── Early payment discount rules (remise paiement annuel complet) ───────────
export function listEarlyPaymentDiscountRules(): Promise<EarlyPaymentDiscountRule[]> {
  return api.get<EarlyPaymentDiscountRule[]>("/billing/early-payment-discount-rules");
}
export function createEarlyPaymentDiscountRule(input: EarlyPaymentDiscountRuleInput): Promise<EarlyPaymentDiscountRule> {
  return api.post<EarlyPaymentDiscountRule>("/billing/early-payment-discount-rules", input);
}
export function updateEarlyPaymentDiscountRule(id: number, input: EarlyPaymentDiscountRuleInput): Promise<EarlyPaymentDiscountRule> {
  return api.put<EarlyPaymentDiscountRule>(`/billing/early-payment-discount-rules/${id}`, input);
}
export function deleteEarlyPaymentDiscountRule(id: number): Promise<void> {
  return api.delete<void>(`/billing/early-payment-discount-rules/${id}`);
}

/**
 * Applique la remise pour paiement annuel complet sur les factures restantes d'un frais (§billing) —
 * à appeler juste avant un paiement groupé couvrant toutes les tranches restantes, pour obtenir les
 * montants nets à utiliser dans les parts du paiement (le calcul de la remise reste côté serveur).
 */
export function applyEarlyPaymentDiscount(studentId: number, feeId: number): Promise<Invoice[]> {
  return api.post<Invoice[]>("/billing/invoices/early-payment-discount", undefined, { query: { studentId, feeId } });
}

/**
 * Annule la remise pour paiement annuel complet précédemment appliquée — à appeler dès que la
 * sélection ne couvre plus toutes les tranches restantes (ex. le parent décoche un mois), sinon la
 * remise resterait acquise indéfiniment même après un changement de sélection.
 */
export function removeEarlyPaymentDiscount(studentId: number, feeId: number): Promise<Invoice[]> {
  return api.delete<Invoice[]>("/billing/invoices/early-payment-discount", { query: { studentId, feeId } });
}

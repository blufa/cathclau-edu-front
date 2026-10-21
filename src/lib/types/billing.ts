/** Billing contracts mirrored from the backend billing module (school fees ↔ parents). */

export type FeeType = "ENROLLMENT" | "RE_ENROLLMENT" | "MONTHLY" | "TRANSPORT" | "CANTEEN" | "EXAM" | "OTHER" | "PLATFORM";

export const FEE_TYPE_LABEL: Record<FeeType, string> = {
  ENROLLMENT: "Inscription",
  RE_ENROLLMENT: "Réinscription",
  MONTHLY: "Mensualité",
  TRANSPORT: "Transport",
  CANTEEN: "Cantine",
  EXAM: "Examen",
  OTHER: "Autre (frais annexe)",
  // Frais annexe configuré par l'école elle-même (nom et montant à sa discrétion) — tout encaissement
  // dessus alimente en plus le solde dû à l'éditeur de la plateforme (voir Platform → Frais plateforme).
  PLATFORM: "Frais plateforme",
};

export interface SchoolFee {
  id: number;
  tenantId: number | null;
  /** Null pour un frais TRANSPORT — voir routeId, une ligne dessert plusieurs classes. */
  classId: number | null;
  /** Ligne de transport (module transport) — utilisé à la place de classId pour un frais TRANSPORT. */
  routeId: number | null;
  type: FeeType;
  amount: string;
  academicYear: string | null;
  /** Nom du frais quand type = OTHER (ex. "Tenue scolaire", "Bus de transport"). */
  label: string | null;
  /** Facturé automatiquement à l'inscription (true, comportement historique) ou seulement ajouté
   * explicitement par le comptable à l'élève concerné (false) — ex. un paquet de RAM facultatif
   * (§13 cahier des charges). */
  mandatory: boolean;
}

/** Les factures effectivement créées pour un frais donné, à la génération groupée d'inscription
 * (§retour comptable, refonte inscription) — vide si une facture existait déjà (idempotent). */
export interface GeneratedFeeInvoices {
  fee: SchoolFee;
  invoices: Invoice[];
}

export interface GenerateAllFeesInput {
  studentId: number;
  classId: number;
  academicYearId: number;
  /** NEW ou RE_ENROLLMENT — exclut la facture du type opposé si la classe a les deux frais configurés. */
  enrollmentType: "NEW" | "RE_ENROLLMENT";
  wantsTransport: boolean;
  transportFeeId?: number | null;
}

export interface SchoolFeeInput {
  tenantId?: number | null;
  classId?: number | null;
  routeId?: number | null;
  type: FeeType;
  amount: number;
  academicYear?: string | null;
  label?: string | null;
  /** Omis ou null = obligatoire (comportement historique). */
  mandatory?: boolean | null;
}

export type InstallmentStatus = "PENDING" | "PAID" | "OVERDUE";

export interface Installment {
  id: number;
  feeId: number;
  label: string;
  amount: string;
  dueDate: string | null;
  status: InstallmentStatus;
  /** Mois "YYYY-MM" couverts par cette tranche, librement choisis (pas forcément consécutifs). */
  months: string[] | null;
}

export interface InstallmentInput {
  label: string;
  amount: number;
  dueDate?: string | null;
  months?: string[];
}

/** Échéance non facturée parce qu'entièrement couverte par une exonération/avantage personnel
 * (§billing) — aucune Invoice n'existe pour elle côté serveur ; à afficher comme une ligne
 * "Exonéré 100%" au même endroit que les vraies factures, jamais cochable/encaissable. */
export interface ExemptedPeriod {
  installmentId: number;
  periodLabel: string;
  discountReason: string | null;
}

/** Réponse de {@link generateMonthlyInvoices} : les factures réellement créées, et les échéances
 * couvertes à 100% par une exonération pour lesquelles aucune facture n'a été générée. */
export interface GenerateMonthlyResult {
  created: Invoice[];
  exemptedPeriods: ExemptedPeriod[];
}

/** CANCELLED : facture annulée sans effet financier (ex. mensualités d'une ancienne classe après un
 * transfert), conservée pour l'historique mais plus jamais comptée dans le facturé/impayé. */
export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID" | "CANCELLED";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  UNPAID: "Impayée",
  PARTIAL: "Partielle",
  PAID: "Payée",
  CANCELLED: "Annulée",
};

export interface Invoice {
  id: number;
  tenantId: number | null;
  studentId: number;
  feeId: number | null;
  academicYearId: number | null;
  reference: string;
  totalAmount: string;
  paidAmount: string | null;
  remainingBalance: string | null;
  status: InvoiceStatus;
  issueDate: string | null;
  installmentId?: number | null;
  periodLabel?: string | null;
  discountAmount?: string | null;
  discountReason?: string | null;
  recoveryStage?: RecoveryStage | null;
  lastReminderAt?: string | null;
  /** Sous-ensemble de mois "YYYY-MM" (parmi ceux de l'échéance liée) effectivement réglés jusqu'ici —
   * pour une facture multi-mois (tranche) payée en plusieurs fois. Vide/absent pour une facture d'un
   * seul mois, ou une tranche réglée en une seule fois (periodLabel suffit alors). */
  paidMonths?: string[] | null;
  /** Non-null uniquement sur une facture dédiée au frais d'usage plateforme (frais annexe, jamais
   * mêlée à la mensualité) — dans ce cas égal à totalAmount. Null/absent sur une facture normale. */
  platformFeeAmount?: string | null;
  /** Montant porté à paidAmount SANS paiement réel correspondant (ex. crédit reporté d'une ancienne
   * classe lors d'un transfert, §retour comptable) — sans ça, une facture apparaît déjà réglée sans
   * aucun encaissement associé, ce qui dérouterait le comptable. Null/absent si aucun crédit. */
  creditedAmount?: string | null;
  /** Motif du crédit reporté (ex. "Crédit reporté de l'ancienne classe (transfert)"). */
  creditReason?: string | null;
}

export type RecoveryStage = "NONE" | "REMINDER_1" | "REMINDER_2" | "EXCLUDED";

export const RECOVERY_STAGE_LABEL: Record<RecoveryStage, string> = {
  NONE: "—",
  REMINDER_1: "Relance 1",
  REMINDER_2: "Relance 2",
  EXCLUDED: "Élève exclu (impayé)",
};

// ── Exemptions (exonérations de frais) ───────────────────────────────────────
export type ExemptionType = "TOTAL" | "PARTIAL" | "EXCEPTIONAL";

export const EXEMPTION_TYPE_LABEL: Record<ExemptionType, string> = {
  TOTAL: "Totale",
  PARTIAL: "Partielle",
  EXCEPTIONAL: "Exceptionnelle",
};

export interface Exemption {
  id: number;
  tenantId: number | null;
  studentId: number;
  type: ExemptionType;
  percentage: string | null;
  amount: string | null;
  /** Un seul type, plusieurs, ou vide/null = tous les frais. */
  feeTypes: FeeType[] | null;
  reason: string | null;
  startDate: string | null;
  endDate: string | null;
  validatedBy: number | null;
  active: boolean;
  createdAt: string | null;
  /** Avantage personnel (enfant de membre du personnel) : la facture est marquée pour la retenue
   * sur salaire, au lieu d'une détection automatique. */
  staffBenefit: boolean;
}

/** Surplus de crédit laissé par un transfert de classe (nouvelle classe moins chère) — à rembourser
 * au parent. Reste visible sur le reçu de l'élève tant que refundedAt est null. */
export interface ClassTransferRefund {
  id: number;
  tenantId: number | null;
  studentId: number;
  oldClassId: number | null;
  newClassId: number | null;
  amount: string;
  reason: string | null;
  createdAt: string;
  refundedAt: string | null;
}

/** Un lot de trop-perçu de l'élève (§4 cahier des charges) — posé automatiquement quand un
 * encaissement dépasse le solde dû d'une facture. remainingAmount décroît à chaque application
 * jusqu'à épuisement (amount reste le montant d'origine, immuable, pour l'historique). */
export interface StudentCredit {
  id: number;
  tenantId: number | null;
  studentId: number;
  amount: string;
  remainingAmount: string;
  sourcePaymentId: number | null;
  sourceInvoiceId: number | null;
  reason: string | null;
  createdAt: string;
}

/** Une application (même partielle) d'un crédit à une facture — l'historique traçable. */
export interface StudentCreditUsage {
  id: number;
  tenantId: number | null;
  studentId: number;
  creditId: number;
  targetInvoiceId: number;
  amount: string;
  appliedByUserId: number | null;
  appliedAt: string;
}

export interface ExemptionInput {
  studentId: number;
  type: ExemptionType;
  percentage?: number | null;
  amount?: number | null;
  feeTypes?: FeeType[] | null;
  reason?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  staffBenefit?: boolean | null;
}

/** Type d'exonération pré-configuré et réutilisable (§retour comptable, refonte inscription) — ex.
 * "Orphelin — 100%", configuré une fois puis choisi dans une liste déroulante à l'inscription. */
export interface ExemptionRule {
  id: number;
  tenantId: number | null;
  label: string;
  type: ExemptionType;
  percentage: string | null;
  amount: string | null;
  feeTypes: FeeType[] | null;
  staffBenefit: boolean;
  active: boolean;
}

export interface ExemptionRuleInput {
  label: string;
  type: ExemptionType;
  percentage?: number | null;
  amount?: number | null;
  feeTypes?: FeeType[] | null;
  staffBenefit?: boolean | null;
  active?: boolean;
}

// ── Staff child benefit policies (avantage enfants du personnel) ─────────────
export interface StaffChildBenefitPolicy {
  id: number;
  tenantId: number | null;
  label: string;
  coveredChildrenCount: number | null;
  coveragePercent: string | null;
  /** Un seul type, plusieurs, ou vide/null = tous les frais. */
  feeTypes: FeeType[] | null;
  active: boolean;
}

export interface StaffChildBenefitPolicyInput {
  label: string;
  coveredChildrenCount?: number | null;
  coveragePercent?: number | null;
  feeTypes?: FeeType[] | null;
  active?: boolean | null;
}

export interface StaffCoverage {
  coveragePercent: string | null;
  policyLabel: string | null;
}

export interface StudentCoverage {
  studentId: number;
  coveragePercent: string;
  policyLabel: string | null;
}

// ── Family discount rules (remise fratrie) ───────────────────────────────────
export interface FamilyDiscountRule {
  id: number;
  tenantId: number | null;
  label: string;
  minChildren: number | null;
  maxChildren: number | null;
  percentage: string | null;
  /** Un seul type, plusieurs, ou vide/null = tous les frais. */
  feeTypes: FeeType[] | null;
  appliesToYoungest: boolean;
  active: boolean;
}

export interface FamilyDiscountRuleInput {
  label: string;
  minChildren?: number | null;
  maxChildren?: number | null;
  percentage?: number | null;
  feeTypes?: FeeType[] | null;
  appliesToYoungest?: boolean | null;
  active?: boolean | null;
}

export interface ApplicableDiscount {
  percentage: string | null;
  ruleLabel: string | null;
}

// ── Early payment discount rules (remise paiement annuel complet) ───────────
export interface EarlyPaymentDiscountRule {
  id: number;
  tenantId: number | null;
  label: string;
  percentage: string | null;
  feeType: FeeType | null;
  active: boolean;
}

export interface EarlyPaymentDiscountRuleInput {
  label: string;
  percentage?: number | null;
  feeType?: FeeType | null;
  active?: boolean | null;
}

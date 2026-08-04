/** Billing contracts mirrored from the backend billing module (school fees ↔ parents). */

export type FeeType = "ENROLLMENT" | "RE_ENROLLMENT" | "MONTHLY" | "TRANSPORT" | "CANTEEN" | "EXAM" | "OTHER";

export const FEE_TYPE_LABEL: Record<FeeType, string> = {
  ENROLLMENT: "Inscription",
  RE_ENROLLMENT: "Réinscription",
  MONTHLY: "Mensualité",
  TRANSPORT: "Transport",
  CANTEEN: "Cantine",
  EXAM: "Examen",
  OTHER: "Autre (frais annexe)",
};

export interface SchoolFee {
  id: number;
  tenantId: number | null;
  classId: number;
  type: FeeType;
  amount: string;
  academicYear: string | null;
  /** Nom du frais quand type = OTHER (ex. "Tenue scolaire", "Bus de transport"). */
  label: string | null;
}

export interface SchoolFeeInput {
  tenantId?: number | null;
  classId: number;
  type: FeeType;
  amount: number;
  academicYear?: string | null;
  label?: string | null;
}

export type InstallmentStatus = "PENDING" | "PAID" | "OVERDUE";

export interface Installment {
  id: number;
  feeId: number;
  label: string;
  amount: string;
  dueDate: string | null;
  status: InstallmentStatus;
}

export interface InstallmentInput {
  label: string;
  amount: number;
  dueDate?: string | null;
}

export type InvoiceStatus = "UNPAID" | "PARTIAL" | "PAID";

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  UNPAID: "Impayée",
  PARTIAL: "Partielle",
  PAID: "Payée",
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
  feeType: FeeType | null;
  reason: string | null;
  startDate: string | null;
  endDate: string | null;
  validatedBy: number | null;
  active: boolean;
  createdAt: string | null;
}

export interface ExemptionInput {
  studentId: number;
  type: ExemptionType;
  percentage?: number | null;
  amount?: number | null;
  feeType?: FeeType | null;
  reason?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

// ── Staff child benefit policies (avantage enfants du personnel) ─────────────
export interface StaffChildBenefitPolicy {
  id: number;
  tenantId: number | null;
  label: string;
  coveredChildrenCount: number | null;
  coveragePercent: string | null;
  feeType: FeeType | null;
  active: boolean;
}

export interface StaffChildBenefitPolicyInput {
  label: string;
  coveredChildrenCount?: number | null;
  coveragePercent?: number | null;
  feeType?: FeeType | null;
  active?: boolean | null;
}

export interface StaffCoverage {
  coveragePercent: string | null;
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
  feeType: FeeType | null;
  appliesToYoungest: boolean;
  active: boolean;
}

export interface FamilyDiscountRuleInput {
  label: string;
  minChildren?: number | null;
  maxChildren?: number | null;
  percentage?: number | null;
  feeType?: FeeType | null;
  appliesToYoungest?: boolean | null;
  active?: boolean | null;
}

export interface ApplicableDiscount {
  percentage: string | null;
  ruleLabel: string | null;
}

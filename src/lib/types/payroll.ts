export type PayslipStatus = "DRAFT" | "VALIDATED" | "PAID";
export type PayslipLineType = "EARNING" | "DEDUCTION";
export type RuleComputation = "FIXED" | "PERCENT_OF_BASE" | "PERCENT_OF_GROSS";

export const PAYSLIP_STATUS_LABEL: Record<PayslipStatus, string> = {
  DRAFT: "Brouillon",
  VALIDATED: "Validée",
  PAID: "Payée",
};

export const LINE_TYPE_LABEL: Record<PayslipLineType, string> = {
  EARNING: "Gain",
  DEDUCTION: "Retenue",
};

export const COMPUTATION_LABEL: Record<RuleComputation, string> = {
  FIXED: "Montant fixe",
  PERCENT_OF_BASE: "% du salaire de base",
  PERCENT_OF_GROSS: "% du brut",
};

/** Nature du salarié (§7.1) : distingue le référentiel Teacher/Employee, qui partagent le même champ
 * `teacherId` numérique (deux séquences d'identifiants distinctes pouvant coïncider). */
export type PayslipEmployeeType = "TEACHER" | "ADMINISTRATIVE" | "DIRECTION" | "SUPPORT";

export interface Payslip {
  id: number;
  teacherId: number;
  employeeType: PayslipEmployeeType;
  periodLabel: string;
  periodStart: string | null;
  periodEnd: string | null;
  baseSalary: number;
  grossSalary: number;
  netSalary: number;
  status: PayslipStatus;
  paymentMethod: string | null;
  notes: string | null;
  createdAt: string | null;
  paidAt: string | null;
}

export interface PayslipLine {
  id: number;
  payslipId: number;
  label: string;
  lineType: PayslipLineType;
  amount: number;
}

export interface SalaryStructure {
  id: number;
  name: string;
  code: string | null;
  active: boolean;
}

export interface SalaryRule {
  id: number;
  structureId: number;
  label: string;
  code: string | null;
  category: string | null;
  lineType: PayslipLineType;
  computation: RuleComputation;
  value: number;
  sequence: number;
}

// ── Règles de déduction sur salaire (frais de scolarité des enfants) ─────────
export interface SalaryFeeDeductionRule {
  id: number;
  tenantId: number | null;
  label: string;
  amountPerChild: string | null;
  maxChildren: number | null;
  cap: string | null;
  active: boolean;
}

export interface SalaryFeeDeductionRuleInput {
  label: string;
  amountPerChild?: number | null;
  maxChildren?: number | null;
  cap?: number | null;
  active?: boolean | null;
}

export interface FeeDeduction {
  amount: string | null;
  label: string | null;
  childrenCount: number;
}

/** Une facture "avantage personnel" du mois — détail du modal de la fiche de paie (§retour comptable).
 * `excluded` : retirée au cas par cas de la retenue (ex. frais annexe facultatif comme Maillots/
 * T-shirts/Tenue scolaire que le parent préfère régler lui-même) — son montant n'est alors PAS compté
 * dans le total retenu, mais elle reste listée (barrée) pour pouvoir être réincluse. */
export interface DeductedInvoiceLine {
  invoiceId: number;
  reference: string | null;
  feeLabel: string | null;
  amount: string;
  periodLabel: string | null;
  excluded: boolean;
}

/** Frais facultatif (ex. cantine en tranches) de la classe de l'enfant, pas encore facturé du tout —
 * informatif seulement, aucune retenue tant que la facture n'existe pas. */
export interface OptionalFeeNotice {
  feeLabel: string | null;
  amount: string;
}

/** Détail de la retenue "avantage personnel" d'un salarié, enfant par enfant. */
export interface ChildDeductionDetail {
  studentId: number;
  studentName: string;
  optedOut: boolean;
  deductedInvoices: DeductedInvoiceLine[];
  optionalFeesNotYetInvoiced: OptionalFeeNotice[];
}

// ── Avances sur salaire (§payroll) ───────────────────────────────────────────
export type SalaryAdvanceStatus = "ACTIVE" | "REPAID" | "CANCELLED";

export const SALARY_ADVANCE_STATUS_LABEL: Record<SalaryAdvanceStatus, string> = {
  ACTIVE: "En cours",
  REPAID: "Soldée",
  CANCELLED: "Annulée",
};

export interface SalaryAdvance {
  id: number;
  tenantId: number | null;
  employeeType: PayslipEmployeeType;
  teacherId: number;
  teacherName: string | null;
  amount: number;
  remainingBalance: number;
  reason: string | null;
  status: SalaryAdvanceStatus;
  grantedAt: string | null;
  lastDeductedAt: string | null;
}

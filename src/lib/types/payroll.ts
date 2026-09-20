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

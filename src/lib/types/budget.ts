export type BudgetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CLOSED";
export type BudgetLineType = "REVENUE" | "EXPENSE";

export const BUDGET_STATUS_LABEL: Record<BudgetStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumis",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
  CLOSED: "Clôturé",
};

export const BUDGET_LINE_TYPE_LABEL: Record<BudgetLineType, string> = {
  REVENUE: "Recette",
  EXPENSE: "Dépense",
};

export interface AnnualBudget {
  id: number;
  tenantId: number | null;
  academicYear: string;
  label: string;
  status: BudgetStatus;
  approvedBy: number | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string | null;
}

export interface BudgetLine {
  id: number;
  tenantId: number | null;
  budgetId: number;
  lineType: BudgetLineType;
  category: string;
  plannedAmount: string;
  actualAmount: string;
  notes: string | null;
}

export interface BudgetSummary {
  plannedRevenue: string;
  actualRevenue: string;
  plannedExpense: string;
  actualExpense: string;
  plannedBalance: string;
  actualBalance: string;
}

export interface AnnualBudgetInput {
  academicYear: string;
  label: string;
  notes?: string | null;
}

export interface BudgetLineInput {
  lineType: BudgetLineType;
  category: string;
  plannedAmount: number;
  actualAmount: number;
  notes?: string | null;
}

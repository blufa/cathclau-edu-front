export type BudgetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CLOSED";
export type BudgetLineType = "REVENUE" | "EXPENSE";
/** Comment un budget d'événement (kermesse, sortie…) est financé si la trésorerie ne suffit pas. */
export type FinancingMode = "NONE" | "COLLECTE" | "PRET";

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

export const FINANCING_MODE_LABEL: Record<FinancingMode, string> = {
  NONE: "Aucun (trésorerie courante)",
  COLLECTE: "Collecte de fonds",
  PRET: "Prêt / avance de trésorerie",
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
  financingMode: FinancingMode | null;
  financingAmount: string | null;
  pdfFile: string | null;
  createdAt: string | null;
}

export interface BudgetLine {
  id: number;
  tenantId: number | null;
  budgetId: number;
  lineType: BudgetLineType;
  category: string;
  /** Quantité (optionnelle) — ex. « 50 chaises à louer ». */
  quantity: number | null;
  /** Prix unitaire (optionnel) — pertinent seulement si quantity est renseignée. */
  unitPrice: string | null;
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
  financingMode?: FinancingMode | null;
  financingAmount?: number | null;
}

export interface BudgetLineInput {
  lineType: BudgetLineType;
  category: string;
  quantity?: number | null;
  unitPrice?: number | null;
  plannedAmount: number;
  actualAmount: number;
  notes?: string | null;
}

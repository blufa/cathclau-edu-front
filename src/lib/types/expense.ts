/** Fiches de dépense mensuelles (§retour comptable, point 31) — remplace le budget annuel
 * prévisionnel par une saisie directe des dépenses/recettes réellement engagées. */
import type { FinancingMode } from "@/lib/types/budget";

export interface MonthlyExpenseSheet {
  id: number;
  tenantId: number | null;
  label: string;
  academicYear: string;
  financingMode: FinancingMode | null;
  financingAmount: string | null;
  createdAt: string | null;
  createdBy: number | null;
  /** Null tant que la fiche est ouverte (modifiable) ; renseigné dès la clôture (verrouillée). */
  closedAt: string | null;
}

export interface Expense {
  id: number;
  tenantId: number | null;
  sheetId: number | null;
  label: string;
  amount: string;
  /** Coché si la dépense était nécessaire (vs. confort/optionnel). */
  necessary: boolean;
  expenseDate: string | null;
  createdAt: string | null;
}

export interface RevenueLine {
  id: number;
  tenantId: number | null;
  sheetId: number | null;
  label: string;
  amount: string;
  revenueDate: string | null;
  createdAt: string | null;
}

export interface SheetDetail {
  sheet: MonthlyExpenseSheet;
  expenses: Expense[];
  revenues: RevenueLine[];
  totalExpenses: string;
  totalRevenues: string;
}

export interface SheetInput {
  label: string;
  academicYear: string;
  financingMode?: FinancingMode | null;
  financingAmount?: number | null;
}

export interface ExpenseLineInput {
  label: string;
  amount: number;
  necessary: boolean;
  expenseDate?: string | null;
}

export interface RevenueLineInput {
  label: string;
  amount: number;
  revenueDate?: string | null;
}

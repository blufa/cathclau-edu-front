/** Expenses contracts mirrored from the backend expenses module. */

export type ExpenseStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "PAID";
export type ExpensePaymentMode = "CASH" | "TRANSFER" | "MOBILE_MONEY" | "CHEQUE";

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  DRAFT: "Brouillon",
  SUBMITTED: "Soumise",
  APPROVED: "Approuvée",
  REJECTED: "Rejetée",
  PAID: "Payée",
};

export const EXPENSE_PAYMENT_MODE_LABEL: Record<ExpensePaymentMode, string> = {
  CASH: "Espèces",
  TRANSFER: "Virement",
  MOBILE_MONEY: "Mobile money",
  CHEQUE: "Chèque",
};

export interface Expense {
  id: number;
  tenantId: number | null;
  categoryId: number | null;
  supplierId: number | null;
  /** Ligne du budget annuel (AnnualBudget) sur laquelle la dépense s'impute — son "réalisé" se met
   * alors à jour automatiquement au paiement. */
  budgetLineId: number | null;
  label: string;
  amount: string;
  currency: string;
  expenseDate: string | null;
  paymentMode: ExpensePaymentMode | null;
  reference: string | null;
  justificationUrl: string | null;
  status: ExpenseStatus;
  rejectionReason: string | null;
  decidedBy: number | null;
  createdAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  paidAt: string | null;
}

export interface ExpenseInput {
  categoryId?: number | null;
  supplierId?: number | null;
  budgetLineId?: number | null;
  label: string;
  amount: number;
  currency?: string | null;
  expenseDate?: string | null;
  paymentMode?: ExpensePaymentMode | null;
  reference?: string | null;
  justificationUrl?: string | null;
}

export interface Supplier {
  id: number;
  tenantId: number | null;
  name: string;
  type: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  bankAccount: string | null;
}

export interface ExpenseCategory {
  id: number;
  tenantId: number | null;
  name: string;
  parentId: number | null;
}

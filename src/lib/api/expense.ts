import { api } from "@/lib/api/client";
import type {
  Expense,
  ExpenseCategory,
  ExpenseInput,
  ExpenseStatus,
  Supplier,
} from "@/lib/types/expense";

// ── Expenses (tenant resolved server-side via TenantContext) ──────────────
export function listExpenses(status?: ExpenseStatus): Promise<Expense[]> {
  return api.get<Expense[]>("/expenses", { query: { status } });
}

export function createExpense(input: ExpenseInput): Promise<Expense> {
  return api.post<Expense>("/expenses", input);
}

export function updateExpense(id: number, input: ExpenseInput): Promise<Expense> {
  return api.put<Expense>(`/expenses/${id}`, input);
}

export function deleteExpense(id: number): Promise<void> {
  return api.delete<void>(`/expenses/${id}`);
}

export function submitExpense(id: number): Promise<Expense> {
  return api.patch<Expense>(`/expenses/${id}/submit`);
}

export function approveExpense(id: number): Promise<Expense> {
  return api.patch<Expense>(`/expenses/${id}/approve`);
}

export function rejectExpense(id: number, reason: string): Promise<Expense> {
  return api.patch<Expense>(`/expenses/${id}/reject`, { reason });
}

export function payExpense(id: number): Promise<Expense> {
  return api.patch<Expense>(`/expenses/${id}/pay`);
}

// ── Suppliers ──────────────────────────────────────────────────────────────
export function listSuppliers(): Promise<Supplier[]> {
  return api.get<Supplier[]>("/suppliers");
}
export function createSupplier(input: Omit<Supplier, "id" | "tenantId">): Promise<Supplier> {
  return api.post<Supplier>("/suppliers", input);
}
export function updateSupplier(id: number, input: Omit<Supplier, "id" | "tenantId">): Promise<Supplier> {
  return api.put<Supplier>(`/suppliers/${id}`, input);
}
export function deleteSupplier(id: number): Promise<void> {
  return api.delete<void>(`/suppliers/${id}`);
}

// ── Categories ───────────────────────────────────────────────────────────────
export function listExpenseCategories(): Promise<ExpenseCategory[]> {
  return api.get<ExpenseCategory[]>("/expense-categories");
}
export function createExpenseCategory(name: string, parentId?: number | null): Promise<ExpenseCategory> {
  return api.post<ExpenseCategory>("/expense-categories", { name, parentId });
}
export function deleteExpenseCategory(id: number): Promise<void> {
  return api.delete<void>(`/expense-categories/${id}`);
}

// ── Budgets ──────────────────────────────────────────────────────────────────
export interface Budget {
  id: number;
  tenantId: number | null;
  categoryId: number;
  academicYear: string;
  allocatedAmount: string;
  /** Cumul des dépenses payées imputées sur cette catégorie — décrémenté automatiquement côté serveur. */
  consumedAmount: string;
  /** allocatedAmount - consumedAmount, calculé côté serveur. */
  remainingBalance: string;
}
export function listBudgets(): Promise<Budget[]> {
  return api.get<Budget[]>("/budgets");
}
export function createBudget(categoryId: number, academicYear: string, allocatedAmount: number): Promise<Budget> {
  return api.post<Budget>("/budgets", { categoryId, academicYear, allocatedAmount });
}
export function updateBudget(id: number, allocatedAmount: number): Promise<Budget> {
  return api.put<Budget>(`/budgets/${id}`, { allocatedAmount });
}
export function deleteBudget(id: number): Promise<void> {
  return api.delete<void>(`/budgets/${id}`);
}

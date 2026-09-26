import { api } from "@/lib/api/client";
import type {
  Expense,
  ExpenseLineInput,
  MonthlyExpenseSheet,
  RevenueLine,
  RevenueLineInput,
  SheetDetail,
  SheetInput,
} from "@/lib/types/expense";

// ── Fiches de dépense mensuelles (tenant résolu côté serveur via TenantContext) ──
export function listMonthlyExpenseSheets(): Promise<MonthlyExpenseSheet[]> {
  return api.get<MonthlyExpenseSheet[]>("/monthly-expense-sheets");
}

export function getMonthlyExpenseSheetDetail(id: number): Promise<SheetDetail> {
  return api.get<SheetDetail>(`/monthly-expense-sheets/${id}`);
}

export function createMonthlyExpenseSheet(input: SheetInput): Promise<MonthlyExpenseSheet> {
  return api.post<MonthlyExpenseSheet>("/monthly-expense-sheets", input);
}

export function closeMonthlyExpenseSheet(id: number): Promise<MonthlyExpenseSheet> {
  return api.patch<MonthlyExpenseSheet>(`/monthly-expense-sheets/${id}/close`);
}

// ── Lignes de dépense ──────────────────────────────────────────────────────────
export function addExpenseLine(sheetId: number, input: ExpenseLineInput): Promise<Expense> {
  return api.post<Expense>(`/monthly-expense-sheets/${sheetId}/expenses`, input);
}
export function updateExpenseLine(lineId: number, input: ExpenseLineInput): Promise<Expense> {
  return api.put<Expense>(`/monthly-expense-sheets/expenses/${lineId}`, input);
}
export function deleteExpenseLine(lineId: number): Promise<void> {
  return api.delete<void>(`/monthly-expense-sheets/expenses/${lineId}`);
}

// ── Lignes de recette (budgets d'événement) ─────────────────────────────────────
export function addRevenueLine(sheetId: number, input: RevenueLineInput): Promise<RevenueLine> {
  return api.post<RevenueLine>(`/monthly-expense-sheets/${sheetId}/revenues`, input);
}
export function updateRevenueLine(lineId: number, input: RevenueLineInput): Promise<RevenueLine> {
  return api.put<RevenueLine>(`/monthly-expense-sheets/revenues/${lineId}`, input);
}
export function deleteRevenueLine(lineId: number): Promise<void> {
  return api.delete<void>(`/monthly-expense-sheets/revenues/${lineId}`);
}

// ── Lecture agrégée, tous mois confondus (dashboards) ───────────────────────────
export function listExpenses(): Promise<Expense[]> {
  return api.get<Expense[]>("/expenses");
}

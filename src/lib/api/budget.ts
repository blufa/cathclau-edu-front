import { api } from "@/lib/api/client";
import type {
  AnnualBudget, AnnualBudgetInput, BudgetLine, BudgetLineInput, BudgetSummary,
} from "@/lib/types/budget";

export function listBudgets(): Promise<AnnualBudget[]> {
  return api.get<AnnualBudget[]>("/annual-budgets");
}
export function getBudget(id: number): Promise<AnnualBudget> {
  return api.get<AnnualBudget>(`/annual-budgets/${id}`);
}
export function getBudgetLines(id: number): Promise<BudgetLine[]> {
  return api.get<BudgetLine[]>(`/annual-budgets/${id}/lines`);
}
export function getBudgetSummary(id: number): Promise<BudgetSummary> {
  return api.get<BudgetSummary>(`/annual-budgets/${id}/summary`);
}
export function createBudget(input: AnnualBudgetInput): Promise<AnnualBudget> {
  return api.post<AnnualBudget>("/annual-budgets", input);
}
export function updateBudget(id: number, input: AnnualBudgetInput): Promise<AnnualBudget> {
  return api.put<AnnualBudget>(`/annual-budgets/${id}`, input);
}
export function submitBudget(id: number): Promise<AnnualBudget> {
  return api.patch<AnnualBudget>(`/annual-budgets/${id}/submit`);
}
export function approveBudget(id: number): Promise<AnnualBudget> {
  return api.patch<AnnualBudget>(`/annual-budgets/${id}/approve`);
}
export function rejectBudget(id: number, reason: string): Promise<AnnualBudget> {
  return api.patch<AnnualBudget>(`/annual-budgets/${id}/reject`, { reason });
}
export function closeBudget(id: number): Promise<AnnualBudget> {
  return api.patch<AnnualBudget>(`/annual-budgets/${id}/close`);
}
export function deleteBudget(id: number): Promise<void> {
  return api.delete<void>(`/annual-budgets/${id}`);
}
export function addBudgetLine(id: number, input: BudgetLineInput): Promise<BudgetLine> {
  return api.post<BudgetLine>(`/annual-budgets/${id}/lines`, input);
}
export function updateBudgetLine(lineId: number, input: BudgetLineInput): Promise<BudgetLine> {
  return api.put<BudgetLine>(`/annual-budgets/lines/${lineId}`, input);
}
export function deleteBudgetLine(lineId: number): Promise<void> {
  return api.delete<void>(`/annual-budgets/lines/${lineId}`);
}

/** Récupère (ou génère à la demande) l'URL du PDF récapitulatif du budget. */
export function getBudgetPdf(id: number): Promise<{ url?: string }> {
  return api.get<{ url?: string }>(`/annual-budgets/${id}/pdf`);
}

/** Flux PDF du budget servi par le backend (object URL local) — indépendant de Cloudinary. */
export function getBudgetPdfObjectUrl(id: number): Promise<string> {
  return api.blobUrl(`/annual-budgets/${id}/pdf/download`);
}

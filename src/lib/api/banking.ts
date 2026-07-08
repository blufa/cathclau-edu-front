import { api } from "@/lib/api/client";
import type {
  BankReconciliation, ReconciliationInput, ReconciliationItem, ReconciliationItemInput, ReconciliationSummary,
} from "@/lib/types/banking";

export function listReconciliations(): Promise<BankReconciliation[]> {
  return api.get<BankReconciliation[]>("/accounting/reconciliations");
}
export function getReconciliationItems(id: number): Promise<ReconciliationItem[]> {
  return api.get<ReconciliationItem[]>(`/accounting/reconciliations/${id}/items`);
}
export function getReconciliationSummary(id: number): Promise<ReconciliationSummary> {
  return api.get<ReconciliationSummary>(`/accounting/reconciliations/${id}/summary`);
}
export function createReconciliation(input: ReconciliationInput): Promise<BankReconciliation> {
  return api.post<BankReconciliation>("/accounting/reconciliations", input);
}
export function completeReconciliation(id: number): Promise<BankReconciliation> {
  return api.patch<BankReconciliation>(`/accounting/reconciliations/${id}/complete`);
}
export function reopenReconciliation(id: number): Promise<BankReconciliation> {
  return api.patch<BankReconciliation>(`/accounting/reconciliations/${id}/reopen`);
}
export function deleteReconciliation(id: number): Promise<void> {
  return api.delete<void>(`/accounting/reconciliations/${id}`);
}
export function addReconciliationItem(id: number, input: ReconciliationItemInput): Promise<ReconciliationItem> {
  return api.post<ReconciliationItem>(`/accounting/reconciliations/${id}/items`, input);
}
export function deleteReconciliationItem(itemId: number): Promise<void> {
  return api.delete<void>(`/accounting/reconciliations/items/${itemId}`);
}

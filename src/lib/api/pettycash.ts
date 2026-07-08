import { api } from "@/lib/api/client";
import type {
  PettyCashFund, PettyCashFundInput, PettyCashTransaction, PettyCashTxInput,
} from "@/lib/types/pettycash";

export function listFunds(): Promise<PettyCashFund[]> {
  return api.get<PettyCashFund[]>("/petty-cash/funds");
}
export function getFundTransactions(id: number): Promise<PettyCashTransaction[]> {
  return api.get<PettyCashTransaction[]>(`/petty-cash/funds/${id}/transactions`);
}
export function getReplenishmentSuggestion(id: number): Promise<{ amount: string }> {
  return api.get<{ amount: string }>(`/petty-cash/funds/${id}/replenishment-suggestion`);
}
export function createFund(input: PettyCashFundInput): Promise<PettyCashFund> {
  return api.post<PettyCashFund>("/petty-cash/funds", input);
}
export function updateFund(id: number, input: PettyCashFundInput): Promise<PettyCashFund> {
  return api.put<PettyCashFund>(`/petty-cash/funds/${id}`, input);
}
export function deleteFund(id: number): Promise<void> {
  return api.delete<void>(`/petty-cash/funds/${id}`);
}
export function recordTransaction(id: number, input: PettyCashTxInput): Promise<PettyCashTransaction> {
  return api.post<PettyCashTransaction>(`/petty-cash/funds/${id}/transactions`, input);
}
export function deleteTransaction(txId: number): Promise<void> {
  return api.delete<void>(`/petty-cash/transactions/${txId}`);
}

import { api } from "@/lib/api/client";
import type { CashDeposit, CashDepositStatus, CreateCashDepositInput } from "@/lib/types/cash-deposit";
import type { PaymentChannel } from "@/lib/types/payment";

/** Enregistre un dépôt (en attente de validation) — idempotencyKey empêche une double soumission
 * (ex. double-clic ou rechargement de page, §5.1). */
export function createCashDeposit(input: CreateCashDepositInput): Promise<CashDeposit> {
  return api.post<CashDeposit>("/payments/cash-deposits", input);
}

export function getCashDeposit(id: number): Promise<CashDeposit> {
  return api.get<CashDeposit>(`/payments/cash-deposits/${id}`);
}

/** Historique filtrable (§5.4) — chaque paramètre optionnel. */
export function searchCashDeposits(params?: {
  accountantId?: number; status?: CashDepositStatus; method?: PaymentChannel;
  from?: string; to?: string;
}): Promise<CashDeposit[]> {
  return api.get<CashDeposit[]>("/payments/cash-deposits", { query: { ...params } });
}

export function validateCashDeposit(id: number): Promise<CashDeposit> {
  return api.patch<CashDeposit>(`/payments/cash-deposits/${id}/validate`);
}

export function rejectCashDeposit(id: number, reason: string): Promise<CashDeposit> {
  return api.patch<CashDeposit>(`/payments/cash-deposits/${id}/reject`, { reason });
}

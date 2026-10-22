import type { PaymentChannel } from "@/lib/types/payment";

/** Dépôt d'argent remis par un comptable au fondateur, avec validation explicite (§5 cahier des
 * charges) — distinct d'une session de caisse (rapprochement comptant/système d'UN comptable) : ici
 * c'est l'argent remis physiquement au fondateur qui doit être confirmé reçu, jamais automatiquement. */
export type CashDepositStatus = "PENDING" | "VALIDATED" | "REJECTED";

export const CASH_DEPOSIT_STATUS_LABEL: Record<CashDepositStatus, string> = {
  PENDING: "En attente",
  VALIDATED: "Validé",
  REJECTED: "Rejeté",
};

/** Moyens de dépôt acceptés — sous-ensemble de {@link PaymentChannel} (mêmes libellés que
 * l'encaissement au guichet, voir DESK_CHANNELS de pay-invoice-form.tsx). */
export type CashDepositMethod = "CASH" | "ORANGE_MONEY" | "BANK_CARD";

export const CASH_DEPOSIT_METHOD_LABEL: Record<CashDepositMethod, string> = {
  CASH: "Espèces",
  ORANGE_MONEY: "Orange Money",
  BANK_CARD: "Virement bancaire",
};

export interface CashDeposit {
  id: number;
  tenantId: number | null;
  accountantId: number;
  amount: string;
  currency: string;
  method: PaymentChannel;
  destinationAccount: string | null;
  depositedAt: string;
  transactionReference: string | null;
  comment: string | null;
  status: CashDepositStatus;
  validatedBy: number | null;
  validatedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export interface CreateCashDepositInput {
  amount: number;
  currency?: string;
  method: CashDepositMethod;
  destinationAccount?: string | null;
  depositedAt?: string;
  transactionReference?: string | null;
  comment?: string | null;
  idempotencyKey: string;
}

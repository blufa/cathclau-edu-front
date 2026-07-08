export type PettyCashTxType = "DISBURSEMENT" | "REPLENISHMENT";

export const PETTY_CASH_TX_TYPE_LABEL: Record<PettyCashTxType, string> = {
  DISBURSEMENT: "Sortie (bon)",
  REPLENISHMENT: "Réapprovisionnement",
};

export interface PettyCashFund {
  id: number;
  tenantId: number | null;
  label: string;
  floatAmount: string;
  currentBalance: string;
  custodian: string | null;
  active: boolean;
  createdAt: string | null;
}

export interface PettyCashTransaction {
  id: number;
  tenantId: number | null;
  fundId: number;
  txDate: string;
  txType: PettyCashTxType;
  amount: string;
  voucherNumber: string | null;
  description: string | null;
  category: string | null;
  recipient: string | null;
  justificationUrl: string | null;
  recordedBy: number | null;
  createdAt: string | null;
}

export interface PettyCashFundInput {
  label: string;
  floatAmount: number;
  custodian?: string | null;
  active?: boolean;
}

export interface PettyCashTxInput {
  txDate?: string | null;
  txType: PettyCashTxType;
  amount: number;
  voucherNumber?: string | null;
  description?: string | null;
  category?: string | null;
  recipient?: string | null;
  justificationUrl?: string | null;
}

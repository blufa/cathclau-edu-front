export type ReconciliationStatus = "DRAFT" | "COMPLETED";
export type ReconciliationItemType =
  | "OUTSTANDING_CHEQUE" | "DEPOSIT_IN_TRANSIT" | "BANK_CHARGE" | "BANK_INTEREST" | "ERROR" | "OTHER";

export const RECON_STATUS_LABEL: Record<ReconciliationStatus, string> = {
  DRAFT: "En cours", COMPLETED: "Clôturé",
};

export const RECON_ITEM_TYPE_LABEL: Record<ReconciliationItemType, string> = {
  OUTSTANDING_CHEQUE: "Chèque non débité (− banque)",
  DEPOSIT_IN_TRANSIT: "Dépôt en transit (+ banque)",
  BANK_CHARGE: "Frais bancaires (− livre)",
  BANK_INTEREST: "Intérêts (+ livre)",
  ERROR: "Erreur (± livre)",
  OTHER: "Autre (± livre)",
};

export interface BankReconciliation {
  id: number;
  tenantId: number | null;
  treasuryAccountId: number;
  statementDate: string;
  statementBalance: string;
  bookBalance: string;
  status: ReconciliationStatus;
  notes: string | null;
  reconciledBy: number | null;
  createdAt: string | null;
}

export interface ReconciliationItem {
  id: number;
  tenantId: number | null;
  reconciliationId: number;
  itemType: ReconciliationItemType;
  description: string | null;
  amount: string;
}

export interface ReconciliationSummary {
  statementBalance: string;
  bookBalance: string;
  adjustedBank: string;
  adjustedBook: string;
  difference: string;
  balanced: boolean;
}

export interface ReconciliationInput {
  treasuryAccountId: number;
  statementDate?: string | null;
  statementBalance: number;
  notes?: string | null;
}

export interface ReconciliationItemInput {
  itemType: ReconciliationItemType;
  description?: string | null;
  amount: number;
}

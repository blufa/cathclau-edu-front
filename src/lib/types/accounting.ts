/** Accounting (SIMPLE level) contracts mirrored from the backend accounting module. */

export type AccountingMode = "SIMPLE" | "DOUBLE_ENTRY";
export type FiscalYearStatus = "OPEN" | "CLOSED";
export type TreasuryAccountType = "CASH" | "BANK";
export type CashFlowDirection = "IN" | "OUT";
export type CashFlowCategory = "TUITION" | "ENROLLMENT" | "SALARY" | "SUPPLIER" | "CHARGE" | "OTHER";
export type CashFlowReferenceType = "PAYMENT" | "EXPENSE" | "MANUAL";

export const ACCOUNT_TYPE_LABEL: Record<TreasuryAccountType, string> = { CASH: "Caisse", BANK: "Banque" };
export const DIRECTION_LABEL: Record<CashFlowDirection, string> = { IN: "Entrée", OUT: "Sortie" };
export const CATEGORY_LABEL: Record<CashFlowCategory, string> = {
  TUITION: "Scolarité", ENROLLMENT: "Inscription", SALARY: "Salaire", SUPPLIER: "Fournisseur", CHARGE: "Charge", OTHER: "Autre",
};
export const FISCAL_STATUS_LABEL: Record<FiscalYearStatus, string> = { OPEN: "Ouvert", CLOSED: "Clôturé" };

export interface AccountingSettings {
  id: number | null;
  tenantId: number | null;
  mode: AccountingMode;
  referential: string | null;
  currency: string | null;
  fiscalYearStartMonth: number | null;
  vatApplicable: boolean | null;
  defaultVatRate: string | null;
  autoNumbering: boolean | null;
  active: boolean | null;
}

export interface FiscalYear {
  id: number;
  tenantId: number | null;
  label: string;
  startDate: string | null;
  endDate: string | null;
  status: FiscalYearStatus;
  academicYearId: number | null;
}

export interface TreasuryAccount {
  id: number;
  tenantId: number | null;
  label: string;
  type: TreasuryAccountType;
  bank: string | null;
  accountNumber: string | null;
  initialBalance: string | null;
  currentBalance: string | null;
  currency: string | null;
  active: boolean | null;
}

export interface CashFlowEntry {
  id: number;
  tenantId: number | null;
  accountId: number;
  direction: CashFlowDirection;
  amount: string;
  currency: string | null;
  date: string | null;
  category: CashFlowCategory | null;
  label: string | null;
  referenceType: CashFlowReferenceType | null;
  referenceId: number | null;
  justificationUrl: string | null;
  reconciled: boolean | null;
}

export interface JournalLine {
  entry: CashFlowEntry;
  runningBalance: string;
}

// ── Double-entry (SYSCOHADA) ─────────────────────────────────────────────────
export type AccountType = "ASSET" | "LIABILITY" | "EXPENSE" | "REVENUE";
export type JournalEntryStatus = "DRAFT" | "VALIDATED" | "LETTERED";

export const ACCOUNT_TYPE_LABEL_SYS: Record<AccountType, string> = {
  ASSET: "Actif", LIABILITY: "Passif", EXPENSE: "Charge", REVENUE: "Produit",
};
export const ENTRY_STATUS_LABEL: Record<JournalEntryStatus, string> = {
  DRAFT: "Brouillon", VALIDATED: "Validée", LETTERED: "Lettrée",
};

export interface ChartOfAccount {
  id: number;
  tenantId: number | null;
  accountNumber: string;
  label: string;
  accountClass: number | null;
  type: AccountType | null;
  parentId: number | null;
  lettrable: boolean | null;
  active: boolean | null;
}

export interface Journal {
  id: number;
  tenantId: number | null;
  code: string;
  label: string | null;
  type: string | null;
  defaultCounterpartAccountId: number | null;
}

export interface JournalEntryLine {
  id?: number;
  journalEntryId?: number | null;
  chartOfAccountId: number;
  label: string | null;
  debit: number | string | null;
  credit: number | string | null;
  lettrageCode?: string | null;
  tiersType?: string | null;
  tiersId?: number | null;
}

export interface JournalEntry {
  id: number;
  tenantId: number | null;
  fiscalYearId: number | null;
  journalId: number | null;
  pieceNumber: string | null;
  date: string | null;
  label: string | null;
  status: JournalEntryStatus;
  totalDebit: string | null;
  totalCredit: string | null;
  lines: JournalEntryLine[];
}

export interface BalanceRow { accountId: number; accountNumber: string; label: string; debit: string; credit: string; balance: string; }
export interface LedgerRow { date: string | null; pieceNumber: string | null; label: string | null; debit: string; credit: string; runningBalance: string; }
export interface IncomeStatement { charges: string; produits: string; resultatNet: string; }
export interface BalanceSheet { actif: string; passif: string; resultatNet: string; }

import { api } from "@/lib/api/client";
import type {
  AccountingMode,
  AccountingSettings,
  AccountType,
  BalanceRow,
  BalanceSheet,
  CashFlowCategory,
  CashFlowDirection,
  CashFlowEntry,
  ChartOfAccount,
  FiscalYear,
  IncomeStatement,
  Journal,
  JournalEntry,
  JournalEntryLine,
  JournalLine,
  LedgerRow,
  TreasuryAccount,
  TreasuryAccountType,
} from "@/lib/types/accounting";

// ── Settings ─────────────────────────────────────────────────────────────────
export interface AccountingSettingsInput {
  mode?: AccountingMode;
  referential?: string | null;
  currency?: string | null;
  fiscalYearStartMonth?: number | null;
  vatApplicable?: boolean | null;
  defaultVatRate?: number | null;
  autoNumbering?: boolean | null;
  active?: boolean | null;
}

export function getAccountingSettings(): Promise<AccountingSettings> {
  return api.get<AccountingSettings>("/accounting/settings");
}
export function updateAccountingSettings(input: AccountingSettingsInput): Promise<AccountingSettings> {
  return api.put<AccountingSettings>("/accounting/settings", input);
}

// ── Fiscal years ─────────────────────────────────────────────────────────────
export function listFiscalYears(): Promise<FiscalYear[]> {
  return api.get<FiscalYear[]>("/accounting/exercices");
}
export function createFiscalYear(input: { label: string; startDate?: string | null; endDate?: string | null; academicYearId?: number | null }): Promise<FiscalYear> {
  return api.post<FiscalYear>("/accounting/exercices", input);
}
export function closeFiscalYear(id: number): Promise<FiscalYear> {
  return api.patch<FiscalYear>(`/accounting/exercices/${id}/cloturer`);
}

// ── Treasury accounts ────────────────────────────────────────────────────────
export function listAccounts(): Promise<TreasuryAccount[]> {
  return api.get<TreasuryAccount[]>("/accounting/comptes");
}
export function createAccount(input: {
  label: string; type: TreasuryAccountType; bank?: string | null; accountNumber?: string | null;
  initialBalance?: number | null; currency?: string | null; active?: boolean;
}): Promise<TreasuryAccount> {
  return api.post<TreasuryAccount>("/accounting/comptes", input);
}
export function adjustAccountBalance(id: number, balance: number): Promise<TreasuryAccount> {
  return api.patch<TreasuryAccount>(`/accounting/comptes/${id}/ajuster-solde`, { balance });
}
export function deleteAccount(id: number): Promise<void> {
  return api.delete<void>(`/accounting/comptes/${id}`);
}
export function getAccountJournal(id: number): Promise<JournalLine[]> {
  return api.get<JournalLine[]>(`/accounting/comptes/${id}/journal`);
}

// ── Movements ────────────────────────────────────────────────────────────────
export function listMovements(): Promise<CashFlowEntry[]> {
  return api.get<CashFlowEntry[]>("/accounting/mouvements");
}
export function createMovement(input: {
  accountId: number; direction: CashFlowDirection; amount: number; date?: string | null;
  category?: CashFlowCategory | null; label?: string | null; justificationUrl?: string | null;
}): Promise<CashFlowEntry> {
  return api.post<CashFlowEntry>("/accounting/mouvements", input);
}
export function deleteMovement(id: number): Promise<void> {
  return api.delete<void>(`/accounting/mouvements/${id}`);
}
export function reconcileMovement(id: number): Promise<CashFlowEntry> {
  return api.post<CashFlowEntry>(`/accounting/mouvements/${id}/rapprocher`);
}

// ── Double-entry (SYSCOHADA) ─────────────────────────────────────────────────
export function listChartOfAccounts(): Promise<ChartOfAccount[]> {
  return api.get<ChartOfAccount[]>("/accounting/plan-comptable");
}
export function createChartAccount(input: { accountNumber: string; label: string; accountClass?: number | null; type?: AccountType | null; parentId?: number | null; lettrable?: boolean; active?: boolean }): Promise<ChartOfAccount> {
  return api.post<ChartOfAccount>("/accounting/plan-comptable", input);
}
export function deleteChartAccount(id: number): Promise<void> {
  return api.delete<void>(`/accounting/plan-comptable/${id}`);
}

export function listJournals(): Promise<Journal[]> {
  return api.get<Journal[]>("/accounting/journaux");
}
export function createJournal(input: { code: string; label?: string | null; type?: string | null }): Promise<Journal> {
  return api.post<Journal>("/accounting/journaux", input);
}
export function deleteJournal(id: number): Promise<void> {
  return api.delete<void>(`/accounting/journaux/${id}`);
}

export function listJournalEntries(fiscalYearId?: number): Promise<JournalEntry[]> {
  return api.get<JournalEntry[]>("/accounting/ecritures", { query: { fiscalYearId } });
}
export function createJournalEntry(input: { fiscalYearId?: number | null; journalId: number; date?: string | null; label?: string | null; lines: JournalEntryLine[] }): Promise<JournalEntry> {
  return api.post<JournalEntry>("/accounting/ecritures", input);
}
export function validateJournalEntry(id: number): Promise<JournalEntry> {
  return api.patch<JournalEntry>(`/accounting/ecritures/${id}/valider`);
}
export function deleteJournalEntry(id: number): Promise<void> {
  return api.delete<void>(`/accounting/ecritures/${id}`);
}

export function getBalance(exercice?: number): Promise<BalanceRow[]> {
  return api.get<BalanceRow[]>("/accounting/balance", { query: { exercice } });
}
export function getGeneralLedger(compte: number, exercice?: number): Promise<LedgerRow[]> {
  return api.get<LedgerRow[]>("/accounting/grand-livre", { query: { compte, exercice } });
}
export function getIncomeStatement(exercice?: number): Promise<IncomeStatement> {
  return api.get<IncomeStatement>("/accounting/compte-resultat", { query: { exercice } });
}
export function getBalanceSheet(exercice?: number): Promise<BalanceSheet> {
  return api.get<BalanceSheet>("/accounting/bilan", { query: { exercice } });
}

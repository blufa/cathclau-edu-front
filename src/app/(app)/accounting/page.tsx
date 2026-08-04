"use client";

import { useState } from "react";
import { Banknote, BookText, CalendarRange, FileSpreadsheet, ListTree, NotebookPen, Plus, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  adjustAccountBalance,
  closeFiscalYear,
  createAccount,
  createFiscalYear,
  createMovement,
  deleteAccount,
  deleteMovement,
  getAccountingSettings,
  listAccounts,
  listFiscalYears,
  listMovements,
  reconcileMovement,
  updateAccountingSettings,
  listChartOfAccounts,
  createChartAccount,
  deleteChartAccount,
  listJournals,
  createJournal,
  deleteJournal,
  listJournalEntries,
  createJournalEntry,
  validateJournalEntry,
  deleteJournalEntry,
  getBalance,
  getIncomeStatement,
  getBalanceSheet,
  getGeneralLedger,
  listFiscalYears as listFiscalYearsForReports,
} from "@/lib/api/accounting";
import {
  ACCOUNT_TYPE_LABEL,
  ACCOUNT_TYPE_LABEL_SYS,
  CATEGORY_LABEL,
  DIRECTION_LABEL,
  ENTRY_STATUS_LABEL,
  FISCAL_STATUS_LABEL,
  type AccountingMode,
  type AccountType,
  type CashFlowCategory,
  type CashFlowDirection,
  type ChartOfAccount,
  type FiscalYearStatus,
  type JournalEntryLine,
  type JournalEntryStatus,
  type TreasuryAccount,
  type TreasuryAccountType,
} from "@/lib/types/accounting";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const FISCAL_TONE: Record<FiscalYearStatus, "green" | "gray"> = { OPEN: "green", CLOSED: "gray" };

export default function AccountingPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  if (!tenantId) {
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Comptabilité</h1>
        <p className="text-sm text-gray-500">Caisses, banques et trésorerie (comptabilité simple)</p>
      </Reveal>
      <Tabs defaultValue="treasury">
        <TabsList>
          <TabsTrigger value="treasury" icon={Banknote}>Trésorerie</TabsTrigger>
          <TabsTrigger value="accounts" icon={ListTree}>Plan comptable</TabsTrigger>
          <TabsTrigger value="journals" icon={BookText}>Journaux</TabsTrigger>
          <TabsTrigger value="entries" icon={NotebookPen}>Écritures</TabsTrigger>
          <TabsTrigger value="reports" icon={FileSpreadsheet}>États</TabsTrigger>
          <TabsTrigger value="fiscal" icon={CalendarRange}>Exercices</TabsTrigger>
          <TabsTrigger value="settings" icon={SettingsIcon}>Paramètres</TabsTrigger>
        </TabsList>
        <TabsPanel value="treasury"><TreasuryTab user={user} /></TabsPanel>
        <TabsPanel value="accounts"><ChartTab user={user} /></TabsPanel>
        <TabsPanel value="journals"><JournalsTab user={user} /></TabsPanel>
        <TabsPanel value="entries"><EntriesTab user={user} /></TabsPanel>
        <TabsPanel value="reports"><ReportsTab /></TabsPanel>
        <TabsPanel value="fiscal"><FiscalTab user={user} /></TabsPanel>
        <TabsPanel value="settings"><SettingsTab user={user} /></TabsPanel>
      </Tabs>
    </div>
  );
}

function TreasuryTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const accountsQuery = useQuery(() => listAccounts(), []);
  const movementsQuery = useQuery(() => listMovements(), []);
  const accounts = accountsQuery.data ?? [];
  const accountName = new Map(accounts.map((a) => [a.id, a.label]));
  const [newAccount, setNewAccount] = useState(false);
  const [newMovement, setNewMovement] = useState(false);

  function adjust(a: TreasuryAccount) {
    const v = window.prompt(`Nouveau solde pour ${a.label} ?`, String(a.currentBalance ?? 0));
    if (v == null) return;
    adjustAccountBalance(a.id, Number(v)).then(() => { notifySuccess("Solde ajusté"); accountsQuery.refetch(); }).catch(notifyError);
  }
  function reconcile(id: number) {
    reconcileMovement(id).then(() => { notifySuccess("Rapproché"); movementsQuery.refetch(); }).catch(notifyError);
  }
  function removeMovement(id: number) {
    confirmAction({ title: "Supprimer le mouvement", message: "Confirmer ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteMovement(id); notifySuccess("Supprimé"); movementsQuery.refetch(); accountsQuery.refetch(); } catch (e) { notifyError(e); } } });
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Caisses & banques</h3>
          {canEdit && <Button size="sm" onClick={() => setNewAccount(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau compte</Button>}
        </div>
        {accountsQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.length === 0 && <p className="text-sm text-gray-400">Aucun compte. Créez une caisse ou une banque.</p>}
            {accounts.map((a) => (
              <div key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-900">{a.label}</span>
                  <Badge tone={a.type === "CASH" ? "amber" : "indigo"}>{ACCOUNT_TYPE_LABEL[a.type]}</Badge>
                </div>
                <p className="mt-2 text-xl font-bold text-gray-900">{formatGNF(a.currentBalance ?? 0)}</p>
                {canEdit && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <button className="text-brand-700 hover:underline" onClick={() => adjust(a)}>Ajuster</button>
                    <button className="text-error-600 hover:underline" onClick={() => confirmAction({ title: "Supprimer le compte", message: a.label, confirmLabel: "Supprimer", danger: true, onConfirm: async () => { try { await deleteAccount(a.id); notifySuccess("Supprimé"); accountsQuery.refetch(); } catch (e) { notifyError(e); } } })}>Supprimer</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Mouvements de trésorerie</h3>
          {canEdit && accounts.length > 0 && <Button size="sm" variant="secondary" onClick={() => setNewMovement(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau mouvement</Button>}
        </div>
        {movementsQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Date</TH><TH>Compte</TH><TH>Sens</TH><TH>Catégorie</TH><TH>Libellé</TH><TH>Montant</TH><TH>Rappr.</TH><TH className="text-right" /></tr></THead>
            <TBody>
              {(movementsQuery.data ?? []).length === 0 && <TR><TD colSpan={8} className="py-10 text-center text-gray-400">Aucun mouvement.</TD></TR>}
              {(movementsQuery.data ?? []).map((m) => (
                <TR key={m.id}>
                  <TD className="text-gray-500">{m.date ?? "—"}</TD>
                  <TD>{accountName.get(m.accountId) ?? `#${m.accountId}`}</TD>
                  <TD><Badge tone={m.direction === "IN" ? "green" : "red"}>{DIRECTION_LABEL[m.direction]}</Badge></TD>
                  <TD>{m.category ? CATEGORY_LABEL[m.category] : "—"}</TD>
                  <TD className="text-gray-700">{m.label ?? (m.referenceType !== "MANUAL" ? `Auto (${m.referenceType})` : "—")}</TD>
                  <TD className="font-medium text-gray-900">{formatGNF(m.amount)}</TD>
                  <TD>{m.reconciled ? "✓" : "—"}</TD>
                  <TD className="text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        {!m.reconciled && <Button size="sm" variant="ghost" onClick={() => reconcile(m.id)}>Rapprocher</Button>}
                        {m.referenceType === "MANUAL" && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => removeMovement(m.id)}>Suppr.</Button>}
                      </div>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </section>

      <Modal open={newAccount} onClose={() => setNewAccount(false)} title="Nouveau compte de trésorerie">
        <AccountForm onCancel={() => setNewAccount(false)} onCreated={() => { setNewAccount(false); notifySuccess("Compte créé"); accountsQuery.refetch(); }} />
      </Modal>
      <Modal open={newMovement} onClose={() => setNewMovement(false)} title="Nouveau mouvement">
        <MovementForm accounts={accounts} onCancel={() => setNewMovement(false)} onCreated={() => { setNewMovement(false); notifySuccess("Mouvement enregistré"); movementsQuery.refetch(); accountsQuery.refetch(); }} />
      </Modal>
    </div>
  );
}

function AccountForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<TreasuryAccountType>("CASH");
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [initialBalance, setInitialBalance] = useState("0");
  async function submit() {
    if (!label.trim()) { notifyError("Libellé requis"); return; }
    setLoading(true);
    try { await createAccount({ label, type, bank, accountNumber, initialBalance: Number(initialBalance) || 0, currency: "GNF" }); onCreated(); } catch (e) { notifyError(e); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field>
        <Label>Type</Label>
        <Select value={type} onChange={(e) => setType(e.target.value as TreasuryAccountType)}>
          {(Object.keys(ACCOUNT_TYPE_LABEL) as TreasuryAccountType[]).map((t) => (<option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>))}
        </Select>
      </Field>
      {type === "BANK" && (
        <div className="grid grid-cols-2 gap-3">
          <Field><Label>Banque</Label><Input value={bank} onChange={(e) => setBank(e.target.value)} /></Field>
          <Field><Label>N° compte</Label><Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></Field>
        </div>
      )}
      <Field>
        <Label>Solde initial (GNF)</Label>
        <Input type="number" value={initialBalance} onChange={(e) => setInitialBalance(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Créer</Button>
      </div>
    </div>
  );
}

function MovementForm({ accounts, onCancel, onCreated }: { accounts: TreasuryAccount[]; onCancel: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [accountId, setAccountId] = useState(String(accounts[0]?.id ?? ""));
  const [direction, setDirection] = useState<CashFlowDirection>("IN");
  const [amount, setAmount] = useState("0");
  const [date, setDate] = useState("");
  const [category, setCategory] = useState<CashFlowCategory>("OTHER");
  const [label, setLabel] = useState("");
  async function submit() {
    if (!accountId) { notifyError("Compte requis"); return; }
    if (!(Number(amount) > 0)) { notifyError("Montant requis"); return; }
    setLoading(true);
    try {
      await createMovement({ accountId: Number(accountId), direction, amount: Number(amount), date: date || null, category, label: label || null });
      onCreated();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <Field>
        <Label>Compte <span className="text-error-500">*</span></Label>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {accounts.map((a) => (<option key={a.id} value={a.id}>{a.label}</option>))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Sens</Label>
          <Select value={direction} onChange={(e) => setDirection(e.target.value as CashFlowDirection)}>
            {(Object.keys(DIRECTION_LABEL) as CashFlowDirection[]).map((d) => (<option key={d} value={d}>{DIRECTION_LABEL[d]}</option>))}
          </Select>
        </Field>
        <Field><Label>Montant (GNF)</Label><Input type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Catégorie</Label>
          <Select value={category} onChange={(e) => setCategory(e.target.value as CashFlowCategory)}>
            {(Object.keys(CATEGORY_LABEL) as CashFlowCategory[]).map((c) => (<option key={c} value={c}>{CATEGORY_LABEL[c]}</option>))}
          </Select>
        </Field>
        <Field><Label>Date</Label><DatePicker value={date} clearable onChange={setDate} /></Field>
      </div>
      <Field><Label>Libellé</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Enregistrer</Button>
      </div>
    </div>
  );
}

function FiscalTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const q = useQuery(() => listFiscalYears(), []);
  const [label, setLabel] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  async function add() {
    if (!label.trim()) { notifyError("Libellé requis"); return; }
    try {
      await createFiscalYear({ label, startDate: startDate || null, endDate: endDate || null });
      setLabel(""); setStartDate(""); setEndDate("");
      notifySuccess("Exercice créé"); q.refetch();
    } catch (e) { notifyError(e); }
  }
  function close(id: number) {
    confirmAction({ title: "Clôturer l'exercice", message: "L'exercice deviendra en lecture seule.", confirmLabel: "Clôturer", danger: true,
      onConfirm: async () => { try { await closeFiscalYear(id); notifySuccess("Exercice clôturé"); q.refetch(); } catch (e) { notifyError(e); } } });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      {canEdit && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Nouvel exercice</h3>
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input placeholder="Exercice 2025-2026" value={label} onChange={(e) => setLabel(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field><Label>Début</Label><DatePicker value={startDate} clearable onChange={setStartDate} /></Field>
            <Field><Label>Fin</Label><DatePicker value={endDate} clearable onChange={setEndDate} /></Field>
          </div>
          <Button onClick={add}>Créer</Button>
        </div>
      )}
      <div>
        {q.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Exercice</TH><TH>Début</TH><TH>Fin</TH><TH>Statut</TH><TH className="text-right" /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun exercice.</TD></TR>}
              {(q.data ?? []).map((f) => (
                <TR key={f.id}>
                  <TD className="font-medium text-gray-900">{f.label}</TD>
                  <TD>{f.startDate ?? "—"}</TD><TD>{f.endDate ?? "—"}</TD>
                  <TD><Badge tone={FISCAL_TONE[f.status]}>{FISCAL_STATUS_LABEL[f.status]}</Badge></TD>
                  <TD className="text-right">{canEdit && f.status === "OPEN" && <Button size="sm" variant="ghost" onClick={() => close(f.id)}>Clôturer</Button>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function SettingsTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const q = useQuery(() => getAccountingSettings(), []);
  const [loading, setLoading] = useState(false);
  const s = q.data;
  const [mode, setMode] = useState<AccountingMode>("SIMPLE");
  const [currency, setCurrency] = useState("GNF");
  const [fiscalYearStartMonth, setFiscalYearStartMonth] = useState("9");
  const [vatApplicable, setVatApplicable] = useState(false);
  const [defaultVatRate, setDefaultVatRate] = useState("0");
  const [autoNumbering, setAutoNumbering] = useState(true);
  const [synced, setSynced] = useState(false);
  if (s && !synced) {
    setMode(s.mode); setCurrency(s.currency ?? "GNF"); setFiscalYearStartMonth(String(s.fiscalYearStartMonth ?? 9));
    setVatApplicable(s.vatApplicable ?? false); setDefaultVatRate(String(s.defaultVatRate ?? 0)); setAutoNumbering(s.autoNumbering ?? true);
    setSynced(true);
  }
  async function submit() {
    setLoading(true);
    try {
      await updateAccountingSettings({ mode, currency, fiscalYearStartMonth: Number(fiscalYearStartMonth) || 9, vatApplicable, defaultVatRate: Number(defaultVatRate) || 0, autoNumbering });
      notifySuccess("Paramètres enregistrés"); q.refetch();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }
  if (q.loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  return (
    <div className="max-w-lg space-y-4">
      <Field>
        <Label>Mode comptable</Label>
        <Select value={mode} onChange={(e) => setMode(e.target.value as AccountingMode)}>
          <option value="SIMPLE">Simple (caisse / banque)</option>
          <option value="DOUBLE_ENTRY">Partie double (SYSCOHADA)</option>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field><Label>Devise</Label><Input value={currency} onChange={(e) => setCurrency(e.target.value)} /></Field>
        <Field><Label>Mois de début d&apos;exercice</Label><Input type="number" min={1} max={12} value={fiscalYearStartMonth} onChange={(e) => setFiscalYearStartMonth(e.target.value)} /></Field>
      </div>
      <div className="flex items-center gap-3">
        <Switch checked={vatApplicable} onChange={setVatApplicable} ariaLabel="TVA applicable" />
        <span className="text-sm text-gray-700">TVA applicable</span>
      </div>
      {vatApplicable && <Field><Label>Taux de TVA par défaut (%)</Label><Input type="number" min={0} value={defaultVatRate} onChange={(e) => setDefaultVatRate(e.target.value)} /></Field>}
      <div className="flex items-center gap-3">
        <Switch checked={autoNumbering} onChange={setAutoNumbering} ariaLabel="Numérotation automatique" />
        <span className="text-sm text-gray-700">Numérotation automatique</span>
      </div>
      {canEdit && <div className="flex justify-end"><Button onClick={submit} loading={loading}>Enregistrer</Button></div>}
    </div>
  );
}

// ── Chart of accounts (plan comptable) ───────────────────────────────────────
const ENTRY_STATUS_TONE: Record<JournalEntryStatus, "gray" | "green" | "indigo"> = { DRAFT: "gray", VALIDATED: "green", LETTERED: "indigo" };

function ChartTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const q = useQuery(() => listChartOfAccounts(), []);
  const [accountNumber, setAccountNumber] = useState("");
  const [label, setLabel] = useState("");
  const [accountClass, setAccountClass] = useState("4");
  const [type, setType] = useState<AccountType>("ASSET");
  async function add() {
    if (!accountNumber.trim() || !label.trim()) { notifyError("N° compte et libellé requis"); return; }
    try {
      await createChartAccount({ accountNumber, label, accountClass: Number(accountClass) || 4, type });
      setAccountNumber(""); setLabel("");
      notifySuccess("Compte ajouté"); q.refetch();
    } catch (e) { notifyError(e); }
  }
  function remove(a: ChartOfAccount) {
    confirmAction({ title: "Supprimer le compte", message: `${a.accountNumber} ${a.label}`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteChartAccount(a.id); notifySuccess("Supprimé"); q.refetch(); } catch (e) { notifyError(e); } } });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {canEdit && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Nouveau compte</h3>
          <Field><Label>N° compte <span className="text-error-500">*</span></Label><Input placeholder="411, 521, 701…" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} /></Field>
          <Field><Label>Libellé <span className="text-error-500">*</span></Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field><Label>Classe</Label><Input type="number" min={1} max={8} value={accountClass} onChange={(e) => setAccountClass(e.target.value)} /></Field>
            <Field>
              <Label>Type</Label>
              <Select value={type} onChange={(e) => setType(e.target.value as AccountType)}>
                {(Object.keys(ACCOUNT_TYPE_LABEL_SYS) as AccountType[]).map((t) => (<option key={t} value={t}>{ACCOUNT_TYPE_LABEL_SYS[t]}</option>))}
              </Select>
            </Field>
          </div>
          <Button onClick={add}>Ajouter</Button>
        </div>
      )}
      <div>
        {q.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>N°</TH><TH>Libellé</TH><TH>Classe</TH><TH>Type</TH><TH /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun compte. Ajoutez votre plan SYSCOHADA.</TD></TR>}
              {(q.data ?? []).map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-gray-600">{a.accountNumber}</TD>
                  <TD className="font-medium text-gray-900">{a.label}</TD>
                  <TD>{a.accountClass ?? "—"}</TD>
                  <TD>{a.type ? ACCOUNT_TYPE_LABEL_SYS[a.type] : "—"}</TD>
                  <TD className="text-right">{canEdit && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(a)}>Suppr.</Button>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ── Journals ─────────────────────────────────────────────────────────────────
function JournalsTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const q = useQuery(() => listJournals(), []);
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [type, setType] = useState("");
  async function add() {
    if (!code.trim()) { notifyError("Code requis"); return; }
    try { await createJournal({ code, label, type }); setCode(""); setLabel(""); setType(""); notifySuccess("Journal créé"); q.refetch(); } catch (e) { notifyError(e); }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {canEdit && (
        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700">Nouveau journal</h3>
          <Field><Label>Code <span className="text-error-500">*</span></Label><Input placeholder="VT, AC, BQ, CA, OD" value={code} onChange={(e) => setCode(e.target.value)} /></Field>
          <Field><Label>Libellé</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
          <Field><Label>Type</Label><Input value={type} onChange={(e) => setType(e.target.value)} /></Field>
          <Button onClick={add}>Créer</Button>
        </div>
      )}
      <div>
        {q.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Code</TH><TH>Libellé</TH><TH>Type</TH><TH /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-gray-400">Aucun journal.</TD></TR>}
              {(q.data ?? []).map((j) => (
                <TR key={j.id}>
                  <TD className="font-mono text-xs text-gray-600">{j.code}</TD>
                  <TD className="font-medium text-gray-900">{j.label ?? "—"}</TD>
                  <TD>{j.type ?? "—"}</TD>
                  <TD className="text-right">{canEdit && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => confirmAction({ title: "Supprimer le journal", message: j.code, confirmLabel: "Supprimer", danger: true, onConfirm: async () => { try { await deleteJournal(j.id); notifySuccess("Supprimé"); q.refetch(); } catch (e) { notifyError(e); } } })}>Suppr.</Button>}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ── Journal entries (écritures) ──────────────────────────────────────────────
function EntriesTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const q = useQuery(() => listJournalEntries(), []);
  const journalsQuery = useQuery(() => listJournals(), []);
  const accountsQuery = useQuery(() => listChartOfAccounts(), []);
  const yearsQuery = useQuery(() => listFiscalYearsForReports(), []);
  const [creating, setCreating] = useState(false);

  async function act(fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notifySuccess(ok); q.refetch(); } catch (e) { notifyError(e); }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">{canEdit && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle écriture</Button>}</div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Pièce</TH><TH>Date</TH><TH>Libellé</TH><TH>Débit</TH><TH>Crédit</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-gray-400">Aucune écriture.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-mono text-xs text-gray-600">{e.pieceNumber}</TD>
                <TD className="text-gray-500">{e.date ?? "—"}</TD>
                <TD className="font-medium text-gray-900">{e.label ?? "—"}</TD>
                <TD>{formatGNF(e.totalDebit ?? 0)}</TD>
                <TD>{formatGNF(e.totalCredit ?? 0)}</TD>
                <TD><Badge tone={ENTRY_STATUS_TONE[e.status]}>{ENTRY_STATUS_LABEL[e.status]}</Badge></TD>
                <TD className="text-right">
                  {canEdit && e.status === "DRAFT" && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => act(() => validateJournalEntry(e.id), "Écriture validée")}>Valider</Button>
                      <Button size="sm" variant="ghost" className="text-error-600" onClick={() => act(() => deleteJournalEntry(e.id), "Supprimée")}>Suppr.</Button>
                    </div>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle écriture">
        <EntryForm journals={journalsQuery.data ?? []} accounts={accountsQuery.data ?? []} years={yearsQuery.data ?? []}
          onCancel={() => setCreating(false)} onCreated={() => { setCreating(false); notifySuccess("Écriture créée"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

function EntryForm({ journals, accounts, years, onCancel, onCreated }: {
  journals: { id: number; code: string }[]; accounts: ChartOfAccount[]; years: { id: number; label: string }[]; onCancel: () => void; onCreated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [journalId, setJournalId] = useState(String(journals[0]?.id ?? ""));
  const [fiscalYearId, setFiscalYearId] = useState(String(years[0]?.id ?? ""));
  const [date, setDate] = useState("");
  const [label, setLabel] = useState("");
  const [lines, setLines] = useState<JournalEntryLine[]>([
    { chartOfAccountId: 0, label: "", debit: 0, credit: 0 },
    { chartOfAccountId: 0, label: "", debit: 0, credit: 0 },
  ]);

  const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = totalDebit === totalCredit && totalDebit > 0;

  function setLine(i: number, patch: Partial<JournalEntryLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!journalId) { notifyError(new Error("Journal requis")); return; }
    if (!balanced) { notifyError(new Error("Écriture déséquilibrée")); return; }
    setLoading(true);
    try {
      await createJournalEntry({
        fiscalYearId: fiscalYearId ? Number(fiscalYearId) : null, journalId: Number(journalId),
        date: date || null, label: label || null,
        lines: lines.filter((l) => l.chartOfAccountId).map((l) => ({
          chartOfAccountId: Number(l.chartOfAccountId), label: l.label || null,
          debit: Number(l.debit || 0) || null, credit: Number(l.credit || 0) || null,
        })),
      });
      onCreated();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Journal</Label>
          <Select value={journalId} onChange={(e) => setJournalId(e.target.value)}>
            {journals.map((j) => (<option key={j.id} value={j.id}>{j.code}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Exercice</Label>
          <Select value={fiscalYearId} onChange={(e) => setFiscalYearId(e.target.value)}>
            <option value="">—</option>
            {years.map((y) => (<option key={y.id} value={y.id}>{y.label}</option>))}
          </Select>
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field><Label>Date</Label><DatePicker value={date} onChange={setDate} /></Field>
        <Field><Label>Libellé</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} /></Field>
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-700">Lignes</span>
          <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setLines((ls) => [...ls, { chartOfAccountId: 0, label: "", debit: 0, credit: 0 }])}>+ Ligne</button>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_90px] gap-2">
            <Select value={String(l.chartOfAccountId)} onChange={(e) => setLine(i, { chartOfAccountId: Number(e.target.value) || 0 })}>
              <option value="0">— Compte —</option>
              {accounts.map((a) => (<option key={a.id} value={a.id}>{a.accountNumber} {a.label}</option>))}
            </Select>
            <input className="h-11 rounded-lg border border-gray-300 px-2 text-sm shadow-theme-xs outline-none focus:border-brand-300" placeholder="Débit" type="number" min={0} value={Number(l.debit ?? 0)} onChange={(e) => setLine(i, { debit: Number(e.target.value) || 0, credit: 0 })} />
            <input className="h-11 rounded-lg border border-gray-300 px-2 text-sm shadow-theme-xs outline-none focus:border-brand-300" placeholder="Crédit" type="number" min={0} value={Number(l.credit ?? 0)} onChange={(e) => setLine(i, { credit: Number(e.target.value) || 0, debit: 0 })} />
          </div>
        ))}
      </div>
      <div className={`rounded-xl px-3 py-2 text-sm ${balanced ? "bg-success-50 text-success-700" : "bg-warning-50 text-warning-700"}`}>
        Total débit {formatGNF(totalDebit)} · Total crédit {formatGNF(totalCredit)} {balanced ? "· équilibré ✓" : "· déséquilibré"}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" loading={loading} disabled={!balanced} onClick={submit}>Créer</Button>
      </div>
    </div>
  );
}

// ── Reports (états) ──────────────────────────────────────────────────────────
function ReportsTab() {
  const balanceQuery = useQuery(() => getBalance(), []);
  const incomeQuery = useQuery(() => getIncomeStatement(), []);
  const sheetQuery = useQuery(() => getBalanceSheet(), []);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Compte de résultat</h3>
          {incomeQuery.loading ? <Spinner /> : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Produits</span><span className="font-medium">{formatGNF(incomeQuery.data?.produits ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Charges</span><span className="font-medium">{formatGNF(incomeQuery.data?.charges ?? 0)}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-1"><span className="font-semibold">Résultat net</span><span className="font-bold text-brand-700">{formatGNF(incomeQuery.data?.resultatNet ?? 0)}</span></div>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Bilan</h3>
          {sheetQuery.loading ? <Spinner /> : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Actif</span><span className="font-medium">{formatGNF(sheetQuery.data?.actif ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Passif</span><span className="font-medium">{formatGNF(sheetQuery.data?.passif ?? 0)}</span></div>
              <div className="flex justify-between border-t border-gray-100 pt-1"><span className="font-semibold">Résultat net</span><span className="font-bold text-brand-700">{formatGNF(sheetQuery.data?.resultatNet ?? 0)}</span></div>
            </div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Balance générale</h3>
        {balanceQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>N°</TH><TH>Compte</TH><TH>Débit</TH><TH>Crédit</TH><TH>Solde</TH></tr></THead>
            <TBody>
              {(balanceQuery.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-8 text-center text-gray-400">Aucune écriture validée.</TD></TR>}
              {(balanceQuery.data ?? []).map((r) => (
                <TR key={r.accountId}>
                  <TD className="font-mono text-xs text-gray-600">{r.accountNumber}</TD>
                  <TD>{r.label}</TD>
                  <TD>{formatGNF(r.debit)}</TD>
                  <TD>{formatGNF(r.credit)}</TD>
                  <TD className="font-medium text-gray-900">{formatGNF(r.balance)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
      <GeneralLedgerCard />
    </div>
  );
}

// ── Grand livre (mouvements d'un compte) ─────────────────────────────────────
function GeneralLedgerCard() {
  const accountsQuery = useQuery(() => listChartOfAccounts(), []);
  const accounts = accountsQuery.data ?? [];
  const [accountId, setAccountId] = useState("");
  const ledgerQuery = useQuery(
    () => (accountId ? getGeneralLedger(Number(accountId)) : Promise.resolve([])),
    [accountId],
  );
  const rows = ledgerQuery.data ?? [];
  const accountOptions: SearchableOption[] = accounts.map((a) => {
    const label = `${a.accountNumber} — ${a.label}`;
    return { value: String(a.id), trigger: label, label, searchText: label };
  });

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-700">Grand livre — mouvements d&apos;un compte</h3>
        <div className="min-w-[260px]">
          <SearchableSelect value={accountId} options={accountOptions} onChange={setAccountId} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucun compte" />
        </div>
      </div>
      {!accountId ? (
        <p className="py-6 text-center text-sm text-gray-400">Sélectionnez un compte pour afficher ses écritures et son solde progressif.</p>
      ) : ledgerQuery.loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Date</TH><TH>Pièce</TH><TH>Libellé</TH><TH>Débit</TH><TH>Crédit</TH><TH>Solde</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-gray-400">Aucun mouvement sur ce compte.</TD></TR>}
            {rows.map((r, i) => (
              <TR key={i}>
                <TD className="whitespace-nowrap text-sm">{r.date ?? "—"}</TD>
                <TD className="font-mono text-xs text-gray-500">{r.pieceNumber ?? "—"}</TD>
                <TD>{r.label ?? "—"}</TD>
                <TD>{formatGNF(r.debit)}</TD>
                <TD>{formatGNF(r.credit)}</TD>
                <TD className="font-medium text-gray-900">{formatGNF(r.runningBalance)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

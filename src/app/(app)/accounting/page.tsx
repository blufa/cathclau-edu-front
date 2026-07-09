"use client";

import { useState } from "react";
import { Select, NumberInput, Stack, Switch, Tabs, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
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
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const FISCAL_TONE: Record<FiscalYearStatus, "green" | "gray"> = { OPEN: "green", CLOSED: "gray" };

export default function AccountingPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }
  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Comptabilité</h1>
        <p className="text-sm text-slate-500">Caisses, banques et trésorerie (comptabilité simple)</p>
      </Reveal>
      <Tabs defaultValue="treasury" color="brand" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="treasury" leftSection={<Banknote className="h-4 w-4" />}>Trésorerie</Tabs.Tab>
          <Tabs.Tab value="accounts" leftSection={<ListTree className="h-4 w-4" />}>Plan comptable</Tabs.Tab>
          <Tabs.Tab value="journals" leftSection={<BookText className="h-4 w-4" />}>Journaux</Tabs.Tab>
          <Tabs.Tab value="entries" leftSection={<NotebookPen className="h-4 w-4" />}>Écritures</Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<FileSpreadsheet className="h-4 w-4" />}>États</Tabs.Tab>
          <Tabs.Tab value="fiscal" leftSection={<CalendarRange className="h-4 w-4" />}>Exercices</Tabs.Tab>
          <Tabs.Tab value="settings" leftSection={<SettingsIcon className="h-4 w-4" />}>Paramètres</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="treasury" pt="lg"><TreasuryTab user={user} /></Tabs.Panel>
        <Tabs.Panel value="accounts" pt="lg"><ChartTab user={user} /></Tabs.Panel>
        <Tabs.Panel value="journals" pt="lg"><JournalsTab user={user} /></Tabs.Panel>
        <Tabs.Panel value="entries" pt="lg"><EntriesTab user={user} /></Tabs.Panel>
        <Tabs.Panel value="reports" pt="lg"><ReportsTab /></Tabs.Panel>
        <Tabs.Panel value="fiscal" pt="lg"><FiscalTab user={user} /></Tabs.Panel>
        <Tabs.Panel value="settings" pt="lg"><SettingsTab user={user} /></Tabs.Panel>
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
          <h3 className="text-sm font-semibold text-slate-700">Caisses & banques</h3>
          {canEdit && <Button size="sm" onClick={() => setNewAccount(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau compte</Button>}
        </div>
        {accountsQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.length === 0 && <p className="text-sm text-slate-400">Aucun compte. Créez une caisse ou une banque.</p>}
            {accounts.map((a) => (
              <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{a.label}</span>
                  <Badge tone={a.type === "CASH" ? "amber" : "indigo"}>{ACCOUNT_TYPE_LABEL[a.type]}</Badge>
                </div>
                <p className="mt-2 text-xl font-bold text-slate-900">{formatGNF(a.currentBalance ?? 0)}</p>
                {canEdit && (
                  <div className="mt-2 flex gap-3 text-xs">
                    <button className="text-brand-700 hover:underline" onClick={() => adjust(a)}>Ajuster</button>
                    <button className="text-red-600 hover:underline" onClick={() => confirmAction({ title: "Supprimer le compte", message: a.label, confirmLabel: "Supprimer", danger: true, onConfirm: async () => { try { await deleteAccount(a.id); notifySuccess("Supprimé"); accountsQuery.refetch(); } catch (e) { notifyError(e); } } })}>Supprimer</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">Mouvements de trésorerie</h3>
          {canEdit && accounts.length > 0 && <Button size="sm" variant="secondary" onClick={() => setNewMovement(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau mouvement</Button>}
        </div>
        {movementsQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Date</TH><TH>Compte</TH><TH>Sens</TH><TH>Catégorie</TH><TH>Libellé</TH><TH>Montant</TH><TH>Rappr.</TH><TH className="text-right" /></tr></THead>
            <TBody>
              {(movementsQuery.data ?? []).length === 0 && <TR><TD colSpan={8} className="py-10 text-center text-slate-400">Aucun mouvement.</TD></TR>}
              {(movementsQuery.data ?? []).map((m) => (
                <TR key={m.id}>
                  <TD className="text-slate-500">{m.date ?? "—"}</TD>
                  <TD>{accountName.get(m.accountId) ?? `#${m.accountId}`}</TD>
                  <TD><Badge tone={m.direction === "IN" ? "green" : "red"}>{DIRECTION_LABEL[m.direction]}</Badge></TD>
                  <TD>{m.category ? CATEGORY_LABEL[m.category] : "—"}</TD>
                  <TD className="text-slate-700">{m.label ?? (m.referenceType !== "MANUAL" ? `Auto (${m.referenceType})` : "—")}</TD>
                  <TD className="font-medium text-slate-900">{formatGNF(m.amount)}</TD>
                  <TD>{m.reconciled ? "✓" : "—"}</TD>
                  <TD className="text-right">
                    {canEdit && (
                      <div className="flex justify-end gap-1">
                        {!m.reconciled && <Button size="sm" variant="ghost" onClick={() => reconcile(m.id)}>Rapprocher</Button>}
                        {m.referenceType === "MANUAL" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeMovement(m.id)}>Suppr.</Button>}
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
  const form = useForm({ mode: "controlled", initialValues: { label: "", type: "CASH" as TreasuryAccountType, bank: "", accountNumber: "", initialBalance: 0, currency: "GNF" }, validate: { label: (v) => (v ? null : "Requis") } });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try { await createAccount(values); onCreated(); } catch (e) { notifyError(e); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk {...form.getInputProps("label")} />
        <Select label="Type" data={(Object.keys(ACCOUNT_TYPE_LABEL) as TreasuryAccountType[]).map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL[t] }))} {...form.getInputProps("type")} />
        {form.values.type === "BANK" && (
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Banque" {...form.getInputProps("bank")} />
            <TextInput label="N° compte" {...form.getInputProps("accountNumber")} />
          </div>
        )}
        <NumberInput label="Solde initial (GNF)" {...form.getInputProps("initialBalance")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Créer</Button>
        </div>
      </Stack>
    </form>
  );
}

function MovementForm({ accounts, onCancel, onCreated }: { accounts: TreasuryAccount[]; onCancel: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: { accountId: String(accounts[0]?.id ?? ""), direction: "IN" as CashFlowDirection, amount: 0, date: "", category: "OTHER" as CashFlowCategory, label: "" },
    validate: { accountId: (v) => (v ? null : "Requis"), amount: (v) => (v > 0 ? null : "Montant requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      await createMovement({ accountId: Number(values.accountId), direction: values.direction, amount: values.amount, date: values.date || null, category: values.category, label: values.label || null });
      onCreated();
    } catch (e) { notifyError(e); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <Select label="Compte" withAsterisk data={accounts.map((a) => ({ value: String(a.id), label: a.label }))} {...form.getInputProps("accountId")} />
        <div className="grid grid-cols-2 gap-3">
          <Select label="Sens" data={(Object.keys(DIRECTION_LABEL) as CashFlowDirection[]).map((d) => ({ value: d, label: DIRECTION_LABEL[d] }))} {...form.getInputProps("direction")} />
          <NumberInput label="Montant (GNF)" min={0} {...form.getInputProps("amount")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Catégorie" data={(Object.keys(CATEGORY_LABEL) as CashFlowCategory[]).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))} {...form.getInputProps("category")} />
          <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("date")} />
        </div>
        <TextInput label="Libellé" {...form.getInputProps("label")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Enregistrer</Button>
        </div>
      </Stack>
    </form>
  );
}

function FiscalTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const q = useQuery(() => listFiscalYears(), []);
  const form = useForm({ mode: "controlled", initialValues: { label: "", startDate: "", endDate: "" }, validate: { label: (v) => (v ? null : "Requis") } });
  async function add(values: typeof form.values) {
    try { await createFiscalYear({ label: values.label, startDate: values.startDate || null, endDate: values.endDate || null }); form.reset(); notifySuccess("Exercice créé"); q.refetch(); }
    catch (e) { notifyError(e); }
  }
  function close(id: number) {
    confirmAction({ title: "Clôturer l'exercice", message: "L'exercice deviendra en lecture seule.", confirmLabel: "Clôturer", danger: true,
      onConfirm: async () => { try { await closeFiscalYear(id); notifySuccess("Exercice clôturé"); q.refetch(); } catch (e) { notifyError(e); } } });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      {canEdit && (
        <form onSubmit={form.onSubmit(add)} className="rounded-2xl border border-slate-200 bg-white p-5">
          <Stack gap="md">
            <h3 className="text-sm font-semibold text-slate-700">Nouvel exercice</h3>
            <TextInput label="Libellé" placeholder="Exercice 2025-2026" withAsterisk {...form.getInputProps("label")} />
            <div className="grid grid-cols-2 gap-3">
              <DatePickerInput label="Début" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("startDate")} />
              <DatePickerInput label="Fin" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("endDate")} />
            </div>
            <Button type="submit">Créer</Button>
          </Stack>
        </form>
      )}
      <div>
        {q.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Exercice</TH><TH>Début</TH><TH>Fin</TH><TH>Statut</TH><TH className="text-right" /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucun exercice.</TD></TR>}
              {(q.data ?? []).map((f) => (
                <TR key={f.id}>
                  <TD className="font-medium text-slate-900">{f.label}</TD>
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
  const form = useForm({
    mode: "controlled",
    initialValues: {
      mode: (s?.mode ?? "SIMPLE") as AccountingMode,
      currency: s?.currency ?? "GNF",
      fiscalYearStartMonth: s?.fiscalYearStartMonth ?? 9,
      vatApplicable: s?.vatApplicable ?? false,
      defaultVatRate: Number(s?.defaultVatRate ?? 0),
      autoNumbering: s?.autoNumbering ?? true,
    },
  });
  // Sync form once the settings load.
  if (s && !form.isDirty() && form.values.currency !== (s.currency ?? "GNF")) {
    form.setValues({ mode: s.mode, currency: s.currency ?? "GNF", fiscalYearStartMonth: s.fiscalYearStartMonth ?? 9, vatApplicable: s.vatApplicable ?? false, defaultVatRate: Number(s.defaultVatRate ?? 0), autoNumbering: s.autoNumbering ?? true });
  }
  async function submit(values: typeof form.values) {
    setLoading(true);
    try { await updateAccountingSettings(values); notifySuccess("Paramètres enregistrés"); q.refetch(); } catch (e) { notifyError(e); } finally { setLoading(false); }
  }
  if (q.loading) return <div className="flex justify-center py-12"><Spinner /></div>;
  return (
    <form onSubmit={form.onSubmit(submit)} className="max-w-lg">
      <Stack gap="md">
        <Select label="Mode comptable" data={[{ value: "SIMPLE", label: "Simple (caisse / banque)" }, { value: "DOUBLE_ENTRY", label: "Partie double (SYSCOHADA)" }]} {...form.getInputProps("mode")} />
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Devise" {...form.getInputProps("currency")} />
          <NumberInput label="Mois de début d'exercice" min={1} max={12} {...form.getInputProps("fiscalYearStartMonth")} />
        </div>
        <Switch label="TVA applicable" color="brand" checked={form.values.vatApplicable} onChange={(e) => form.setFieldValue("vatApplicable", e.currentTarget.checked)} />
        {form.values.vatApplicable && <NumberInput label="Taux de TVA par défaut (%)" min={0} {...form.getInputProps("defaultVatRate")} />}
        <Switch label="Numérotation automatique" color="brand" checked={form.values.autoNumbering} onChange={(e) => form.setFieldValue("autoNumbering", e.currentTarget.checked)} />
        {canEdit && <div className="flex justify-end"><Button type="submit" loading={loading}>Enregistrer</Button></div>}
      </Stack>
    </form>
  );
}

// ── Chart of accounts (plan comptable) ───────────────────────────────────────
const ENTRY_STATUS_TONE: Record<JournalEntryStatus, "gray" | "green" | "indigo"> = { DRAFT: "gray", VALIDATED: "green", LETTERED: "indigo" };

function ChartTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const q = useQuery(() => listChartOfAccounts(), []);
  const form = useForm({ mode: "controlled", initialValues: { accountNumber: "", label: "", accountClass: 4, type: "ASSET" as AccountType }, validate: { accountNumber: (v) => (v ? null : "Requis"), label: (v) => (v ? null : "Requis") } });
  async function add(values: typeof form.values) {
    try { await createChartAccount(values); form.reset(); notifySuccess("Compte ajouté"); q.refetch(); } catch (e) { notifyError(e); }
  }
  function remove(a: ChartOfAccount) {
    confirmAction({ title: "Supprimer le compte", message: `${a.accountNumber} ${a.label}`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteChartAccount(a.id); notifySuccess("Supprimé"); q.refetch(); } catch (e) { notifyError(e); } } });
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {canEdit && (
        <form onSubmit={form.onSubmit(add)} className="rounded-2xl border border-slate-200 bg-white p-5">
          <Stack gap="md">
            <h3 className="text-sm font-semibold text-slate-700">Nouveau compte</h3>
            <TextInput label="N° compte" placeholder="411, 521, 701…" withAsterisk {...form.getInputProps("accountNumber")} />
            <TextInput label="Libellé" withAsterisk {...form.getInputProps("label")} />
            <div className="grid grid-cols-2 gap-3">
              <NumberInput label="Classe" min={1} max={8} {...form.getInputProps("accountClass")} />
              <Select label="Type" data={(Object.keys(ACCOUNT_TYPE_LABEL_SYS) as AccountType[]).map((t) => ({ value: t, label: ACCOUNT_TYPE_LABEL_SYS[t] }))} {...form.getInputProps("type")} />
            </div>
            <Button type="submit">Ajouter</Button>
          </Stack>
        </form>
      )}
      <div>
        {q.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>N°</TH><TH>Libellé</TH><TH>Classe</TH><TH>Type</TH><TH /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucun compte. Ajoutez votre plan SYSCOHADA.</TD></TR>}
              {(q.data ?? []).map((a) => (
                <TR key={a.id}>
                  <TD className="font-mono text-xs text-slate-600">{a.accountNumber}</TD>
                  <TD className="font-medium text-slate-900">{a.label}</TD>
                  <TD>{a.accountClass ?? "—"}</TD>
                  <TD>{a.type ? ACCOUNT_TYPE_LABEL_SYS[a.type] : "—"}</TD>
                  <TD className="text-right">{canEdit && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(a)}>Suppr.</Button>}</TD>
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
  const form = useForm({ mode: "controlled", initialValues: { code: "", label: "", type: "" }, validate: { code: (v) => (v ? null : "Requis") } });
  async function add(values: typeof form.values) {
    try { await createJournal(values); form.reset(); notifySuccess("Journal créé"); q.refetch(); } catch (e) { notifyError(e); }
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
      {canEdit && (
        <form onSubmit={form.onSubmit(add)} className="rounded-2xl border border-slate-200 bg-white p-5">
          <Stack gap="md">
            <h3 className="text-sm font-semibold text-slate-700">Nouveau journal</h3>
            <TextInput label="Code" placeholder="VT, AC, BQ, CA, OD" withAsterisk {...form.getInputProps("code")} />
            <TextInput label="Libellé" {...form.getInputProps("label")} />
            <TextInput label="Type" {...form.getInputProps("type")} />
            <Button type="submit">Créer</Button>
          </Stack>
        </form>
      )}
      <div>
        {q.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Code</TH><TH>Libellé</TH><TH>Type</TH><TH /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={4} className="py-10 text-center text-slate-400">Aucun journal.</TD></TR>}
              {(q.data ?? []).map((j) => (
                <TR key={j.id}>
                  <TD className="font-mono text-xs text-slate-600">{j.code}</TD>
                  <TD className="font-medium text-slate-900">{j.label ?? "—"}</TD>
                  <TD>{j.type ?? "—"}</TD>
                  <TD className="text-right">{canEdit && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => confirmAction({ title: "Supprimer le journal", message: j.code, confirmLabel: "Supprimer", danger: true, onConfirm: async () => { try { await deleteJournal(j.id); notifySuccess("Supprimé"); q.refetch(); } catch (e) { notifyError(e); } } })}>Suppr.</Button>}</TD>
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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={7} className="py-10 text-center text-slate-400">Aucune écriture.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-mono text-xs text-slate-600">{e.pieceNumber}</TD>
                <TD className="text-slate-500">{e.date ?? "—"}</TD>
                <TD className="font-medium text-slate-900">{e.label ?? "—"}</TD>
                <TD>{formatGNF(e.totalDebit ?? 0)}</TD>
                <TD>{formatGNF(e.totalCredit ?? 0)}</TD>
                <TD><Badge tone={ENTRY_STATUS_TONE[e.status]}>{ENTRY_STATUS_LABEL[e.status]}</Badge></TD>
                <TD className="text-right">
                  {canEdit && e.status === "DRAFT" && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => act(() => validateJournalEntry(e.id), "Écriture validée")}>Valider</Button>
                      <Button size="sm" variant="ghost" className="text-red-600" onClick={() => act(() => deleteJournalEntry(e.id), "Supprimée")}>Suppr.</Button>
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
    <Stack gap="md">
      <div className="grid grid-cols-2 gap-3">
        <Select label="Journal" data={journals.map((j) => ({ value: String(j.id), label: j.code }))} value={journalId} onChange={(value) => setJournalId(value ?? "")} />
        <Select label="Exercice" data={[{ value: "", label: "—" }, ...years.map((y) => ({ value: String(y.id), label: y.label }))]} value={fiscalYearId} onChange={(value) => setFiscalYearId(value ?? "")} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DatePickerInput label="Date" value={date || null} onChange={(v) => setDate(v ?? "")} valueFormat="DD/MM/YYYY" />
        <TextInput label="Libellé" value={label} onChange={(e) => setLabel(e.currentTarget.value)} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">Lignes</span>
          <button type="button" className="text-xs text-brand-700 hover:underline" onClick={() => setLines((ls) => [...ls, { chartOfAccountId: 0, label: "", debit: 0, credit: 0 }])}>+ Ligne</button>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="grid grid-cols-[1fr_90px_90px] gap-2">
            <Select data={[{ value: "0", label: "— Compte —" }, ...accounts.map((a) => ({ value: String(a.id), label: `${a.accountNumber} ${a.label}` }))]}
              value={String(l.chartOfAccountId)} onChange={(value) => setLine(i, { chartOfAccountId: Number(value ?? 0) })} />
            <NumberInput placeholder="Débit" min={0} value={Number(l.debit ?? 0)} onChange={(v) => setLine(i, { debit: Number(v) || 0, credit: 0 })} />
            <NumberInput placeholder="Crédit" min={0} value={Number(l.credit ?? 0)} onChange={(v) => setLine(i, { credit: Number(v) || 0, debit: 0 })} />
          </div>
        ))}
      </div>
      <div className={`rounded-xl px-3 py-2 text-sm ${balanced ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
        Total débit {formatGNF(totalDebit)} · Total crédit {formatGNF(totalCredit)} {balanced ? "· équilibré ✓" : "· déséquilibré"}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" loading={loading} disabled={!balanced} onClick={submit}>Créer</Button>
      </div>
    </Stack>
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Compte de résultat</h3>
          {incomeQuery.loading ? <Spinner /> : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Produits</span><span className="font-medium">{formatGNF(incomeQuery.data?.produits ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Charges</span><span className="font-medium">{formatGNF(incomeQuery.data?.charges ?? 0)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1"><span className="font-semibold">Résultat net</span><span className="font-bold text-brand-700">{formatGNF(incomeQuery.data?.resultatNet ?? 0)}</span></div>
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">Bilan</h3>
          {sheetQuery.loading ? <Spinner /> : (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Actif</span><span className="font-medium">{formatGNF(sheetQuery.data?.actif ?? 0)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Passif</span><span className="font-medium">{formatGNF(sheetQuery.data?.passif ?? 0)}</span></div>
              <div className="flex justify-between border-t border-slate-100 pt-1"><span className="font-semibold">Résultat net</span><span className="font-bold text-brand-700">{formatGNF(sheetQuery.data?.resultatNet ?? 0)}</span></div>
            </div>
          )}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Balance générale</h3>
        {balanceQuery.loading ? <div className="flex justify-center py-8"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>N°</TH><TH>Compte</TH><TH>Débit</TH><TH>Crédit</TH><TH>Solde</TH></tr></THead>
            <TBody>
              {(balanceQuery.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-8 text-center text-slate-400">Aucune écriture validée.</TD></TR>}
              {(balanceQuery.data ?? []).map((r) => (
                <TR key={r.accountId}>
                  <TD className="font-mono text-xs text-slate-600">{r.accountNumber}</TD>
                  <TD>{r.label}</TD>
                  <TD>{formatGNF(r.debit)}</TD>
                  <TD>{formatGNF(r.credit)}</TD>
                  <TD className="font-medium text-slate-900">{formatGNF(r.balance)}</TD>
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
  const [accountId, setAccountId] = useState<number | null>(null);
  const ledgerQuery = useQuery(
    () => (accountId ? getGeneralLedger(accountId) : Promise.resolve([])),
    [accountId],
  );
  const rows = ledgerQuery.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-700">Grand livre — mouvements d&apos;un compte</h3>
        <div className="min-w-[260px]">
          <Select
            placeholder="Choisir un compte…" searchable clearable
            data={accounts.map((a) => ({ value: String(a.id), label: `${a.accountNumber} — ${a.label}` }))}
            value={accountId ? String(accountId) : null}
            onChange={(v) => setAccountId(v ? Number(v) : null)}
            nothingFoundMessage="Aucun compte"
          />
        </div>
      </div>
      {!accountId ? (
        <p className="py-6 text-center text-sm text-slate-400">Sélectionnez un compte pour afficher ses écritures et son solde progressif.</p>
      ) : ledgerQuery.loading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Date</TH><TH>Pièce</TH><TH>Libellé</TH><TH>Débit</TH><TH>Crédit</TH><TH>Solde</TH></tr></THead>
          <TBody>
            {rows.length === 0 && <TR><TD colSpan={6} className="py-8 text-center text-slate-400">Aucun mouvement sur ce compte.</TD></TR>}
            {rows.map((r, i) => (
              <TR key={i}>
                <TD className="whitespace-nowrap text-sm">{r.date ?? "—"}</TD>
                <TD className="font-mono text-xs text-slate-500">{r.pieceNumber ?? "—"}</TD>
                <TD>{r.label ?? "—"}</TD>
                <TD>{formatGNF(r.debit)}</TD>
                <TD>{formatGNF(r.credit)}</TD>
                <TD className="font-medium text-slate-900">{formatGNF(r.runningBalance)}</TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

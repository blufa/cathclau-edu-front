"use client";

import { useState } from "react";
import { Select as MantineSelect, NumberInput, Stack, Tabs, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Building2, LineChart, Plus, Receipt, Tags, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  approveExpense,
  createBudget,
  createExpense,
  updateExpense,
  createExpenseCategory,
  createSupplier,
  deleteBudget,
  deleteExpense,
  deleteExpenseCategory,
  deleteSupplier,
  listBudgets,
  listExpenseCategories,
  listExpenses,
  listSuppliers,
  payExpense,
  rejectExpense,
  submitExpense,
  updateSupplier,
} from "@/lib/api/expense";
import { listPaymentsByTenant } from "@/lib/api/payment";
import {
  EXPENSE_PAYMENT_MODE_LABEL,
  EXPENSE_STATUS_LABEL,
  type Expense,
  type ExpenseCategory,
  type ExpensePaymentMode,
  type ExpenseStatus,
  type Supplier,
} from "@/lib/types/expense";
import { Button } from "@/components/ui/button";
import { PhoneInput } from "@/components/ui/phone-input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { StatCard } from "@/components/ui/stat-card";
import { FileUpload } from "@/components/ui/file-upload";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AreaTrendChart } from "@/components/charts/area-trend-chart";
import { DonutChart, type DonutSlice } from "@/components/charts/donut-chart";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const MONTHS = ["Janv", "Févr", "Mars", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
const PALETTE = ["#14b8a6", "#6366f1", "#f59e0b", "#0ea5e9", "#f43f5e", "#10b981", "#a855f7", "#94a3b8"];

const STATUS_TONE: Record<ExpenseStatus, "gray" | "amber" | "green" | "red" | "indigo"> = {
  DRAFT: "gray", SUBMITTED: "amber", APPROVED: "indigo", REJECTED: "red", PAID: "green",
};

export default function ExpensesPage() {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;

  if (!tenantId) {
    return <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Dépenses</h1>
        <p className="text-sm text-slate-500">Saisie, validation et paiement des dépenses de l&apos;école</p>
      </Reveal>
      <Tabs defaultValue="expenses" color="brand" variant="pills" radius="md">
        <Tabs.List>
          <Tabs.Tab value="expenses" leftSection={<Receipt className="h-4 w-4" />}>Dépenses</Tabs.Tab>
          <Tabs.Tab value="budgets" leftSection={<Wallet className="h-4 w-4" />}>Budgets</Tabs.Tab>
          <Tabs.Tab value="reports" leftSection={<LineChart className="h-4 w-4" />}>Rapports</Tabs.Tab>
          <Tabs.Tab value="treasury" leftSection={<LineChart className="h-4 w-4" />}>Trésorerie</Tabs.Tab>
          <Tabs.Tab value="suppliers" leftSection={<Building2 className="h-4 w-4" />}>Fournisseurs</Tabs.Tab>
          <Tabs.Tab value="categories" leftSection={<Tags className="h-4 w-4" />}>Catégories</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="expenses" pt="lg"><ExpensesTab user={user} /></Tabs.Panel>
        <Tabs.Panel value="budgets" pt="lg"><BudgetsTab user={user} /></Tabs.Panel>
        <Tabs.Panel value="reports" pt="lg"><ReportsTab /></Tabs.Panel>
        <Tabs.Panel value="treasury" pt="lg"><TreasuryTab tenantId={tenantId} /></Tabs.Panel>
        <Tabs.Panel value="suppliers" pt="lg"><SuppliersTab /></Tabs.Panel>
        <Tabs.Panel value="categories" pt="lg"><CategoriesTab /></Tabs.Panel>
      </Tabs>
    </div>
  );
}

// ── Expenses tab ─────────────────────────────────────────────────────────────
function ExpensesTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "ACCOUNTANT");
  const canApprove = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const [status, setStatus] = useState<ExpenseStatus | "">("");
  const q = useQuery(() => listExpenses(status || undefined), [status]);
  const suppliersQuery = useQuery(() => listSuppliers(), []);
  const categoriesQuery = useQuery(() => listExpenseCategories(), []);
  const supplierName = new Map((suppliersQuery.data ?? []).map((s) => [s.id, s.name]));
  const categoryName = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  async function act(e: Expense, fn: () => Promise<unknown>, ok: string) {
    try { await fn(); notifySuccess(ok); q.refetch(); } catch (err) { notifyError(err); }
  }
  function reject(e: Expense) {
    const reason = window.prompt("Motif du rejet ?") ?? "";
    if (!reason) return;
    act(e, () => rejectExpense(e.id, reason), "Dépense rejetée");
  }
  function remove(e: Expense) {
    confirmAction({ title: "Supprimer la dépense", message: `Supprimer « ${e.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: () => act(e, () => deleteExpense(e.id), "Dépense supprimée") });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Select className="max-w-[200px]" value={status} onChange={(e) => setStatus(e.target.value as ExpenseStatus | "")}>
          <option value="">Tous les statuts</option>
          {(Object.keys(EXPENSE_STATUS_LABEL) as ExpenseStatus[]).map((s) => (<option key={s} value={s}>{EXPENSE_STATUS_LABEL[s]}</option>))}
        </Select>
        {canEdit && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle dépense</Button>}
      </div>

      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Libellé</TH><TH>Catégorie</TH><TH>Fournisseur</TH><TH>Montant</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-slate-400">Aucune dépense.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-slate-900">{e.label}
                  {e.status === "REJECTED" && e.rejectionReason && <span className="block text-xs text-red-500">Motif : {e.rejectionReason}</span>}
                </TD>
                <TD>{e.categoryId ? (categoryName.get(e.categoryId) ?? "—") : "—"}</TD>
                <TD>{e.supplierId ? (supplierName.get(e.supplierId) ?? "—") : "—"}</TD>
                <TD className="font-medium text-slate-900">{formatGNF(e.amount)}</TD>
                <TD><Badge tone={STATUS_TONE[e.status]}>{EXPENSE_STATUS_LABEL[e.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit && e.status === "DRAFT" && <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Modifier</Button>}
                    {canEdit && e.status === "DRAFT" && <Button size="sm" onClick={() => act(e, () => submitExpense(e.id), "Dépense soumise")}>Soumettre</Button>}
                    {canApprove && e.status === "SUBMITTED" && <Button size="sm" variant="ghost" className="text-emerald-700" onClick={() => act(e, () => approveExpense(e.id), "Approuvée")}>Approuver</Button>}
                    {canApprove && e.status === "SUBMITTED" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => reject(e)}>Rejeter</Button>}
                    {canEdit && e.status === "APPROVED" && <Button size="sm" onClick={() => act(e, () => payExpense(e.id), "Dépense payée")}>Payer</Button>}
                    {canEdit && e.status === "DRAFT" && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(e)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier la dépense" : "Nouvelle dépense"}>
        <ExpenseForm initial={editing} suppliers={suppliersQuery.data ?? []} categories={categoriesQuery.data ?? []}
          onCancel={() => { setCreating(false); setEditing(null); }}
          onSaved={() => { setCreating(false); setEditing(null); notifySuccess(editing ? "Dépense mise à jour" : "Dépense créée (brouillon)"); q.refetch(); }} />
      </Modal>
    </div>
  );
}

function ExpenseForm({ initial, suppliers, categories, onCancel, onSaved }: {
  initial?: Expense | null; suppliers: Supplier[]; categories: ExpenseCategory[]; onCancel: () => void; onSaved: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      categoryId: initial?.categoryId ? String(initial.categoryId) : "",
      supplierId: initial?.supplierId ? String(initial.supplierId) : "",
      label: initial?.label ?? "",
      amount: initial?.amount ? Number(initial.amount) : 0,
      expenseDate: initial?.expenseDate ?? "",
      paymentMode: (initial?.paymentMode ?? "CASH") as ExpensePaymentMode,
      reference: initial?.reference ?? "",
      justificationUrl: initial?.justificationUrl ?? "",
    },
    validate: { label: (v) => (v ? null : "Requis"), amount: (v) => (v > 0 ? null : "Montant requis") },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        categoryId: values.categoryId ? Number(values.categoryId) : null,
        supplierId: values.supplierId ? Number(values.supplierId) : null,
        label: values.label, amount: values.amount, expenseDate: values.expenseDate || null,
        paymentMode: values.paymentMode, reference: values.reference || null, justificationUrl: values.justificationUrl || null,
      };
      if (initial) await updateExpense(initial.id, payload);
      else await createExpense(payload);
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk {...form.getInputProps("label")} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Montant (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("amount")} />
          <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("expenseDate")} />
        </div>
        <MantineSelect label="Catégorie" data={[{ value: "", label: "—" }, ...categories.map((c) => ({ value: String(c.id), label: c.name }))]} {...form.getInputProps("categoryId")} />
        <MantineSelect label="Fournisseur" data={[{ value: "", label: "—" }, ...suppliers.map((s) => ({ value: String(s.id), label: s.name }))]} {...form.getInputProps("supplierId")} />
        <MantineSelect label="Mode de paiement" data={(Object.keys(EXPENSE_PAYMENT_MODE_LABEL) as ExpensePaymentMode[]).map((m) => ({ value: m, label: EXPENSE_PAYMENT_MODE_LABEL[m] }))} {...form.getInputProps("paymentMode")} />
        <TextInput label="Référence pièce" {...form.getInputProps("reference")} />
        <FileUpload label="Justificatif" variant="document" folder="expenses/justificatifs"
          value={form.values.justificationUrl}
          onChange={(url) => form.setFieldValue("justificationUrl", url ?? "")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
        </div>
      </Stack>
    </form>
  );
}

// ── Suppliers tab ────────────────────────────────────────────────────────────
function SuppliersTab() {
  const q = useQuery(() => listSuppliers(), []);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const form = useForm({ mode: "controlled", initialValues: { name: "", type: "", phone: "", email: "", address: "", bankAccount: "" }, validate: { name: (v) => (v ? null : "Requis") } });

  function open(s: Supplier | null) {
    setEditing(s); setCreating(!s);
    form.setValues({ name: s?.name ?? "", type: s?.type ?? "", phone: s?.phone ?? "", email: s?.email ?? "", address: s?.address ?? "", bankAccount: s?.bankAccount ?? "" });
  }
  async function submit(values: typeof form.values) {
    try {
      if (editing) await updateSupplier(editing.id, values);
      else await createSupplier(values);
      setEditing(null); setCreating(false); notifySuccess("Fournisseur enregistré"); q.refetch();
    } catch (err) { notifyError(err); }
  }
  function remove(s: Supplier) {
    confirmAction({ title: "Supprimer le fournisseur", message: `Supprimer ${s.name} ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteSupplier(s.id); notifySuccess("Supprimé"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><Button onClick={() => open(null)} leftSection={<Plus className="h-4 w-4" />}>Nouveau fournisseur</Button></div>
      {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <Table>
          <THead><tr><TH>Nom</TH><TH>Type</TH><TH>Téléphone</TH><TH>Email</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucun fournisseur.</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-slate-900">{s.name}</TD><TD>{s.type ?? "—"}</TD><TD>{s.phone ?? "—"}</TD><TD>{s.email ?? "—"}</TD>
                <TD className="text-right"><div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => open(s)}>Modifier</Button>
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s)}>Suppr.</Button>
                </div></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}>
        <form onSubmit={form.onSubmit(submit)}>
          <Stack gap="md">
            <TextInput label="Nom" withAsterisk {...form.getInputProps("name")} />
            <TextInput label="Type" {...form.getInputProps("type")} />
            <div className="grid grid-cols-2 gap-3">
              <PhoneInput label="Téléphone" {...form.getInputProps("phone")} />
              <TextInput label="Email" {...form.getInputProps("email")} />
            </div>
            <TextInput label="Adresse" {...form.getInputProps("address")} />
            <TextInput label="RIB / Compte" {...form.getInputProps("bankAccount")} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>Annuler</Button>
              <Button type="submit">Enregistrer</Button>
            </div>
          </Stack>
        </form>
      </Modal>
    </div>
  );
}

// ── Categories tab ───────────────────────────────────────────────────────────
function CategoriesTab() {
  const q = useQuery(() => listExpenseCategories(), []);
  const form = useForm({ mode: "controlled", initialValues: { name: "", parentId: "" }, validate: { name: (v) => (v ? null : "Requis") } });

  async function submit(values: typeof form.values) {
    try { await createExpenseCategory(values.name, values.parentId ? Number(values.parentId) : null); form.reset(); notifySuccess("Catégorie créée"); q.refetch(); }
    catch (err) { notifyError(err); }
  }
  function remove(c: ExpenseCategory) {
    confirmAction({ title: "Supprimer la catégorie", message: `Supprimer ${c.name} ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteExpenseCategory(c.id); notifySuccess("Supprimée"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <form onSubmit={form.onSubmit(submit)} className="rounded-2xl border border-slate-200 bg-white p-5">
        <Stack gap="md">
          <h3 className="text-sm font-semibold text-slate-700">Nouvelle catégorie</h3>
          <TextInput label="Nom" withAsterisk {...form.getInputProps("name")} />
          <MantineSelect label="Parent (optionnel)" data={[{ value: "", label: "— Racine —" }, ...(q.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]} {...form.getInputProps("parentId")} />
          <Button type="submit">Ajouter</Button>
        </Stack>
      </form>
      <div>
        {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Catégorie</TH><TH>Parent</TH><TH /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={3} className="py-10 text-center text-slate-400">Aucune catégorie.</TD></TR>}
              {(q.data ?? []).map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-slate-900">{c.name}</TD>
                  <TD>{c.parentId ? ((q.data ?? []).find((p) => p.id === c.parentId)?.name ?? "—") : "—"}</TD>
                  <TD className="text-right"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(c)}>Suppr.</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
    </div>
  );
}

// ── Budgets tab ──────────────────────────────────────────────────────────────
function BudgetsTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");
  const budgetsQuery = useQuery(() => listBudgets(), []);
  const categoriesQuery = useQuery(() => listExpenseCategories(), []);
  const expensesQuery = useQuery(() => listExpenses("PAID"), []);
  const categoryName = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));

  // Consumed per category = sum of PAID expenses.
  const consumed = new Map<number, number>();
  for (const e of expensesQuery.data ?? []) {
    if (e.categoryId != null) consumed.set(e.categoryId, (consumed.get(e.categoryId) ?? 0) + Number(e.amount));
  }

  const form = useForm({ mode: "controlled", initialValues: { categoryId: "", academicYear: "", allocatedAmount: 0 }, validate: { categoryId: (v) => (v ? null : "Requis"), academicYear: (v) => (v ? null : "Requis") } });
  async function add(values: typeof form.values) {
    try { await createBudget(Number(values.categoryId), values.academicYear, values.allocatedAmount); form.reset(); notifySuccess("Budget enregistré"); budgetsQuery.refetch(); }
    catch (err) { notifyError(err); }
  }
  function remove(id: number) {
    confirmAction({ title: "Supprimer le budget", message: "Supprimer cette allocation ?", confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteBudget(id); notifySuccess("Supprimé"); budgetsQuery.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={form.onSubmit(add)} className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <MantineSelect label="Catégorie" data={[{ value: "", label: "—" }, ...(categoriesQuery.data ?? []).map((c) => ({ value: String(c.id), label: c.name }))]} {...form.getInputProps("categoryId")} />
          <TextInput label="Année" placeholder="2025-2026" {...form.getInputProps("academicYear")} />
          <NumberInput label="Montant alloué (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("allocatedAmount")} />
          <Button type="submit">Allouer</Button>
        </form>
      )}
      {budgetsQuery.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
        <div className="space-y-3">
          {(budgetsQuery.data ?? []).length === 0 && <p className="py-8 text-center text-sm text-slate-400">Aucun budget alloué.</p>}
          {(budgetsQuery.data ?? []).map((b) => {
            const used = consumed.get(b.categoryId) ?? 0;
            const alloc = Number(b.allocatedAmount);
            const pct = alloc > 0 ? Math.min(Math.round((used / alloc) * 100), 100) : 0;
            const over = used > alloc;
            return (
              <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900">{categoryName.get(b.categoryId) ?? `#${b.categoryId}`} <span className="text-xs font-normal text-slate-400">· {b.academicYear}</span></span>
                  <span className="text-sm text-slate-600">{formatGNF(used)} / {formatGNF(alloc)}</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full ${over ? "bg-rose-500" : pct >= 85 ? "bg-amber-500" : "bg-brand-500"}`} style={{ width: `${over ? 100 : pct}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  {over ? <span className="text-xs text-rose-600">Dépassement de {formatGNF(used - alloc)}</span> : <span className="text-xs text-slate-400">{pct}% consommé</span>}
                  {canEdit && <button className="text-xs text-red-600 hover:underline" onClick={() => remove(b.id)}>Supprimer</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Reports tab ──────────────────────────────────────────────────────────────
function ReportsTab() {
  const expensesQuery = useQuery(() => listExpenses("PAID"), []);
  const categoriesQuery = useQuery(() => listExpenseCategories(), []);
  const suppliersQuery = useQuery(() => listSuppliers(), []);
  const categoryName = new Map((categoriesQuery.data ?? []).map((c) => [c.id, c.name]));
  const supplierName = new Map((suppliersQuery.data ?? []).map((s) => [s.id, s.name]));
  const paid = expensesQuery.data ?? [];

  // By category (donut)
  const byCat = new Map<string, number>();
  for (const e of paid) { const k = e.categoryId != null ? (categoryName.get(e.categoryId) ?? `#${e.categoryId}`) : "Sans catégorie"; byCat.set(k, (byCat.get(k) ?? 0) + Number(e.amount)); }
  const catSlices: DonutSlice[] = [...byCat.entries()].map(([name, value], i) => ({ name, value: Math.round(value), color: PALETTE[i % PALETTE.length] }));

  // By month (area)
  const byMonth = new Map<string, number>();
  for (const e of paid) { const k = (e.expenseDate ?? e.paidAt ?? "").slice(0, 7); if (k) byMonth.set(k, (byMonth.get(k) ?? 0) + Number(e.amount)); }
  const monthData = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6)
    .map(([k, v]) => ({ name: MONTHS[Number(k.slice(5, 7)) - 1] ?? k, Dépenses: Math.round(v) }));

  // By supplier
  const bySup = new Map<string, number>();
  for (const e of paid) { const k = e.supplierId != null ? (supplierName.get(e.supplierId) ?? `#${e.supplierId}`) : "—"; bySup.set(k, (bySup.get(k) ?? 0) + Number(e.amount)); }
  const supRows = [...bySup.entries()].sort((a, b) => b[1] - a[1]);

  if (expensesQuery.loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Dépenses payées par mois</h3>
        {monthData.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p> :
          <AreaTrendChart data={monthData} valueFormatter={(v) => formatGNF(v)} series={[{ key: "Dépenses", name: "Dépenses", color: "#f43f5e" }]} />}
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Par catégorie</h3>
        <DonutChart data={catSlices} centerLabel="dépenses" valueFormatter={(v) => formatGNF(v)} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-3">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Par fournisseur</h3>
        <Table>
          <THead><tr><TH>Fournisseur</TH><TH className="text-right">Total payé</TH></tr></THead>
          <TBody>
            {supRows.length === 0 && <TR><TD colSpan={2} className="py-6 text-center text-slate-400">Aucune donnée.</TD></TR>}
            {supRows.map(([name, total]) => (<TR key={name}><TD>{name}</TD><TD className="text-right font-medium text-slate-900">{formatGNF(total)}</TD></TR>))}
          </TBody>
        </Table>
      </div>
    </div>
  );
}

// ── Treasury tab ─────────────────────────────────────────────────────────────
function TreasuryTab({ tenantId }: { tenantId: number }) {
  const paymentsQuery = useQuery(() => listPaymentsByTenant(tenantId), [tenantId]);
  const expensesQuery = useQuery(() => listExpenses("PAID"), []);

  const income = (paymentsQuery.data ?? []).filter((p) => p.status === "SUCCEEDED").reduce((s, p) => s + Number(p.amount), 0);
  const outflow = (expensesQuery.data ?? []).reduce((s, e) => s + Number(e.amount), 0);
  const balance = income - outflow;

  // Monthly income vs outflow (last 6)
  const inc = new Map<string, number>();
  for (const p of paymentsQuery.data ?? []) { if (p.status !== "SUCCEEDED") continue; const k = (p.paidAt ?? "").slice(0, 7); if (k) inc.set(k, (inc.get(k) ?? 0) + Number(p.amount)); }
  const out = new Map<string, number>();
  for (const e of expensesQuery.data ?? []) { const k = (e.expenseDate ?? e.paidAt ?? "").slice(0, 7); if (k) out.set(k, (out.get(k) ?? 0) + Number(e.amount)); }
  const months = [...new Set([...inc.keys(), ...out.keys()])].sort().slice(-6);
  const data = months.map((k) => ({ name: MONTHS[Number(k.slice(5, 7)) - 1] ?? k, Entrées: Math.round(inc.get(k) ?? 0), Sorties: Math.round(out.get(k) ?? 0) }));

  if (paymentsQuery.loading || expensesQuery.loading) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Entrées (encaissements)" value={formatGNF(income)} icon={Receipt} accent="emerald" />
        <StatCard title="Sorties (dépenses payées)" value={formatGNF(outflow)} icon={Wallet} accent="rose" />
        <StatCard title="Solde de trésorerie" value={formatGNF(balance)} icon={LineChart} accent={balance >= 0 ? "teal" : "amber"} />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">Entrées vs sorties (6 derniers mois)</h3>
        {data.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">Aucune donnée.</p> :
          <AreaTrendChart data={data} valueFormatter={(v) => formatGNF(v)} series={[{ key: "Entrées", name: "Entrées", color: "#14b8a6" }, { key: "Sorties", name: "Sorties", color: "#f43f5e" }]} />}
      </div>
    </div>
  );
}

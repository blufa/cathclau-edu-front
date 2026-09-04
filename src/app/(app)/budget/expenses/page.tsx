"use client";

import { useMemo, useState } from "react";
import { Building2, LineChart, Plus, Receipt, Tags, Wallet } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  approveExpense,
  createExpense,
  updateExpense,
  createExpenseCategory,
  createSupplier,
  deleteExpense,
  deleteExpenseCategory,
  deleteSupplier,
  listExpenseCategories,
  listExpenses,
  listSuppliers,
  payExpense,
  rejectExpense,
  submitExpense,
  updateSupplier,
} from "@/lib/api/expense";
import { listBudgets, getBudgetLines } from "@/lib/api/budget";
import type { AnnualBudget } from "@/lib/types/budget";
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
import { Field, Input, Label, MoneyInput } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Tabs, TabsList, TabsPanel, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarTrendChart } from "@/components/charts/bar-trend-chart";
import { type BreakdownItem } from "@/components/charts/bar-breakdown-chart";
import { PieBreakdownChart } from "@/components/charts/pie-breakdown-chart";
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
    return <div className="rounded-xl bg-warning-50 px-4 py-3 text-sm text-warning-800">Réservé aux comptes d&apos;établissement.</div>;
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Dépenses</h1>
        <p className="text-sm text-gray-500">Saisie, validation et paiement des dépenses de l&apos;école</p>
      </Reveal>
      <Tabs defaultValue="categories">
        <TabsList>
          <TabsTrigger value="categories" icon={Tags}>Catégories</TabsTrigger>
          <TabsTrigger value="expenses" icon={Receipt}>Dépenses</TabsTrigger>
          <TabsTrigger value="reports" icon={LineChart}>Rapports</TabsTrigger>
          <TabsTrigger value="treasury" icon={LineChart}>Trésorerie</TabsTrigger>
          <TabsTrigger value="suppliers" icon={Building2}>Fournisseurs</TabsTrigger>
        </TabsList>
        <TabsPanel value="categories"><CategoriesTab /></TabsPanel>
        <TabsPanel value="expenses"><ExpensesTab user={user} /></TabsPanel>
        <TabsPanel value="reports"><ReportsTab /></TabsPanel>
        <TabsPanel value="treasury"><TreasuryTab tenantId={tenantId} /></TabsPanel>
        <TabsPanel value="suppliers"><SuppliersTab /></TabsPanel>
      </Tabs>
    </div>
  );
}

// ── Expenses tab ─────────────────────────────────────────────────────────────
function ExpensesTab({ user }: { user: ReturnType<typeof useAuth>["user"] }) {
  const canEdit = hasRole(user, "SCHOOL_ADMIN", "ACCOUNTANT") || hasAnyPermission(user, ["depense:create"]);
  const canApprove = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["depense:approve"]);

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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-gray-400">Aucune dépense.</TD></TR>}
            {(q.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-gray-900">{e.label}
                  {e.status === "REJECTED" && e.rejectionReason && <span className="block text-xs text-error-500">Motif : {e.rejectionReason}</span>}
                </TD>
                <TD>{e.categoryId ? (categoryName.get(e.categoryId) ?? "—") : "—"}</TD>
                <TD>{e.supplierId ? (supplierName.get(e.supplierId) ?? "—") : "—"}</TD>
                <TD className="font-medium text-gray-900">{formatGNF(e.amount)}</TD>
                <TD><Badge tone={STATUS_TONE[e.status]}>{EXPENSE_STATUS_LABEL[e.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {canEdit && e.status === "DRAFT" && <Button size="sm" variant="ghost" onClick={() => setEditing(e)}>Modifier</Button>}
                    {canEdit && e.status === "DRAFT" && <Button size="sm" onClick={() => act(e, () => submitExpense(e.id), "Dépense soumise")}>Soumettre</Button>}
                    {canApprove && e.status === "SUBMITTED" && <Button size="sm" variant="ghost" className="text-success-700" onClick={() => act(e, () => approveExpense(e.id), "Approuvée")}>Approuver</Button>}
                    {canApprove && e.status === "SUBMITTED" && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => reject(e)}>Rejeter</Button>}
                    {canEdit && e.status === "APPROVED" && <Button size="sm" onClick={() => act(e, () => payExpense(e.id), "Dépense payée")}>Payer</Button>}
                    {canEdit && e.status === "DRAFT" && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(e)}>Suppr.</Button>}
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
  const [categoryId, setCategoryId] = useState(initial?.categoryId ? String(initial.categoryId) : "");
  const [supplierId, setSupplierId] = useState(initial?.supplierId ? String(initial.supplierId) : "");
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(initial?.amount ? String(Number(initial.amount)) : "0");
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate ?? "");
  const [paymentMode, setPaymentMode] = useState<ExpensePaymentMode>(initial?.paymentMode ?? "CASH");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [justificationUrl, setJustificationUrl] = useState(initial?.justificationUrl ?? "");

  // Budget annuel : le comptable peut imputer la dépense sur une ligne du budget en cours — son
  // "réalisé" se met alors à jour automatiquement au paiement (pas besoin de le ressaisir).
  const budgetsQuery = useQuery(() => listBudgets(), []);
  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const [budgetId, setBudgetId] = useState("");
  const linesQuery = useQuery(() => (budgetId ? getBudgetLines(Number(budgetId)) : Promise.resolve([])), [budgetId]);
  const expenseLines = useMemo(() => (linesQuery.data ?? []).filter((l) => l.lineType === "EXPENSE"), [linesQuery.data]);
  const [budgetLineId, setBudgetLineId] = useState(initial?.budgetLineId ? String(initial.budgetLineId) : "");

  async function submit() {
    if (!label.trim()) { notifyError("Libellé requis"); return; }
    if (!(Number(amount) > 0)) { notifyError("Montant requis"); return; }
    setLoading(true);
    try {
      const payload = {
        categoryId: categoryId ? Number(categoryId) : null,
        supplierId: supplierId ? Number(supplierId) : null,
        budgetLineId: budgetLineId ? Number(budgetLineId) : null,
        label, amount: Number(amount), expenseDate: expenseDate || null,
        paymentMode, reference: reference || null, justificationUrl: justificationUrl || null,
      };
      if (initial) await updateExpense(initial.id, payload);
      else await createExpense(payload);
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field><Label>Montant</Label><MoneyInput value={amount} onValueChange={(n) => setAmount(String(n))} /></Field>
        <Field><Label>Date</Label><DatePicker value={expenseDate} clearable onChange={setExpenseDate} /></Field>
      </div>
      <Field>
        <Label>Catégorie</Label>
        <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">—</option>
          {categories.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Fournisseur</Label>
        <Select value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
          <option value="">—</option>
          {suppliers.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Budget annuel (optionnel)</Label>
          <Select value={budgetId} onChange={(e) => { setBudgetId(e.target.value); setBudgetLineId(""); }}>
            <option value="">—</option>
            {budgets.map((b: AnnualBudget) => (<option key={b.id} value={b.id}>{b.label} ({b.academicYear})</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Ligne du budget</Label>
          <Select value={budgetLineId} disabled={!budgetId} onChange={(e) => setBudgetLineId(e.target.value)}>
            <option value="">{budgetId ? "—" : "Choisir un budget d'abord"}</option>
            {expenseLines.map((l) => (<option key={l.id} value={l.id}>{l.category}</option>))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Mode de paiement</Label>
        <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as ExpensePaymentMode)}>
          {(Object.keys(EXPENSE_PAYMENT_MODE_LABEL) as ExpensePaymentMode[]).map((m) => (<option key={m} value={m}>{EXPENSE_PAYMENT_MODE_LABEL[m]}</option>))}
        </Select>
      </Field>
      <Field><Label>Référence pièce</Label><Input value={reference} onChange={(e) => setReference(e.target.value)} /></Field>
      <Field>
        <Label>Justificatif</Label>
        <FileUpload variant="document" folder="expenses/justificatifs" value={justificationUrl}
          onChange={(url) => setJustificationUrl(url ?? "")} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </div>
  );
}

// ── Suppliers tab ────────────────────────────────────────────────────────────
function SuppliersTab() {
  const q = useQuery(() => listSuppliers(), []);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  function open(s: Supplier | null) {
    setEditing(s); setCreating(!s);
    setName(s?.name ?? ""); setType(s?.type ?? ""); setPhone(s?.phone ?? "");
    setEmail(s?.email ?? ""); setAddress(s?.address ?? ""); setBankAccount(s?.bankAccount ?? "");
  }
  async function submit() {
    if (!name.trim()) { notifyError("Nom requis"); return; }
    try {
      const payload = { name, type, phone, email, address, bankAccount };
      if (editing) await updateSupplier(editing.id, payload);
      else await createSupplier(payload);
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
            {(q.data ?? []).length === 0 && <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucun fournisseur.</TD></TR>}
            {(q.data ?? []).map((s) => (
              <TR key={s.id}>
                <TD className="font-medium text-gray-900">{s.name}</TD><TD>{s.type ?? "—"}</TD><TD>{s.phone ?? "—"}</TD><TD>{s.email ?? "—"}</TD>
                <TD className="text-right"><div className="flex justify-end gap-1">
                  <Button size="sm" variant="ghost" onClick={() => open(s)}>Modifier</Button>
                  <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(s)}>Suppr.</Button>
                </div></TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier le fournisseur" : "Nouveau fournisseur"}>
        <div className="space-y-4">
          <Field><Label>Nom <span className="text-error-500">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field><Label>Type</Label><Input value={type} onChange={(e) => setType(e.target.value)} /></Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhoneInput label="Téléphone" value={phone} onChange={setPhone} />
            <Field><Label>Email</Label><Input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          </div>
          <Field><Label>Adresse</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
          <Field><Label>RIB / Compte</Label><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setCreating(false); setEditing(null); }}>Annuler</Button>
            <Button type="button" onClick={submit}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

// ── Categories tab ───────────────────────────────────────────────────────────
function CategoriesTab() {
  const q = useQuery(() => listExpenseCategories(), []);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("");

  async function submit() {
    if (!name.trim()) { notifyError("Nom requis"); return; }
    try { await createExpenseCategory(name, parentId ? Number(parentId) : null); setName(""); setParentId(""); notifySuccess("Catégorie créée"); q.refetch(); }
    catch (err) { notifyError(err); }
  }
  function remove(c: ExpenseCategory) {
    confirmAction({ title: "Supprimer la catégorie", message: `Supprimer ${c.name} ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteExpenseCategory(c.id); notifySuccess("Supprimée"); q.refetch(); } catch (err) { notifyError(err); } } });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="text-sm font-semibold text-gray-700">Nouvelle catégorie</h3>
        <Field><Label>Nom <span className="text-error-500">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field>
          <Label>Parent (optionnel)</Label>
          <Select value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">— Racine —</option>
            {(q.data ?? []).map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </Select>
        </Field>
        <Button onClick={submit}>Ajouter</Button>
      </div>
      <div>
        {q.loading ? <div className="flex justify-center py-12"><Spinner /></div> : (
          <Table>
            <THead><tr><TH>Catégorie</TH><TH>Parent</TH><TH /></tr></THead>
            <TBody>
              {(q.data ?? []).length === 0 && <TR><TD colSpan={3} className="py-10 text-center text-gray-400">Aucune catégorie.</TD></TR>}
              {(q.data ?? []).map((c) => (
                <TR key={c.id}>
                  <TD className="font-medium text-gray-900">{c.name}</TD>
                  <TD>{c.parentId ? ((q.data ?? []).find((p) => p.id === c.parentId)?.name ?? "—") : "—"}</TD>
                  <TD className="text-right"><Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(c)}>Suppr.</Button></TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </div>
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

  // By category (bar breakdown)
  const byCat = new Map<string, number>();
  for (const e of paid) { const k = e.categoryId != null ? (categoryName.get(e.categoryId) ?? `#${e.categoryId}`) : "Sans catégorie"; byCat.set(k, (byCat.get(k) ?? 0) + Number(e.amount)); }
  const catSlices: BreakdownItem[] = [...byCat.entries()].map(([name, value], i) => ({ name, value: Math.round(value), color: PALETTE[i % PALETTE.length] }));

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
      <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Dépenses payées par mois</h3>
        {monthData.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">Aucune donnée.</p> :
          <BarTrendChart data={monthData} valueFormatter={(v) => formatGNF(v)} series={[{ key: "Dépenses", name: "Dépenses", color: "#f43f5e" }]} />}
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Par catégorie</h3>
        <PieBreakdownChart data={catSlices} centerLabel="dépenses" valueFormatter={(v) => formatGNF(v)} />
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-3">
        <h3 className="mb-3 text-sm font-semibold text-gray-700">Par fournisseur</h3>
        <Table>
          <THead><tr><TH>Fournisseur</TH><TH className="text-right">Total payé</TH></tr></THead>
          <TBody>
            {supRows.length === 0 && <TR><TD colSpan={2} className="py-6 text-center text-gray-400">Aucune donnée.</TD></TR>}
            {supRows.map(([name, total]) => (<TR key={name}><TD>{name}</TD><TD className="text-right font-medium text-gray-900">{formatGNF(total)}</TD></TR>))}
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

  const splitSlices: BreakdownItem[] = [
    { name: "Entrées", value: Math.round(Math.max(income, 0)), color: "#14b8a6" },
    { name: "Sorties", value: Math.round(Math.max(outflow, 0)), color: "#f43f5e" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Entrées (encaissements)" value={formatGNF(income)} icon={Receipt} accent="emerald" />
        <StatCard title="Sorties (dépenses payées)" value={formatGNF(outflow)} icon={Wallet} accent="rose" />
        <StatCard title="Solde de trésorerie" value={formatGNF(balance)} icon={LineChart} accent={balance >= 0 ? "teal" : "amber"} />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 lg:col-span-2">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Entrées vs sorties (6 derniers mois)</h3>
          {data.length === 0 ? <p className="py-8 text-center text-sm text-gray-400">Aucune donnée.</p> :
            <BarTrendChart data={data} valueFormatter={(v) => formatGNF(v)} series={[{ key: "Entrées", name: "Entrées", color: "#14b8a6" }, { key: "Sorties", name: "Sorties", color: "#f43f5e" }]} />}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-gray-700">Répartition entrées / sorties</h3>
          <PieBreakdownChart data={splitSlices} centerLabel="au total" valueFormatter={(v) => formatGNF(v)} />
        </div>
      </div>
    </div>
  );
}

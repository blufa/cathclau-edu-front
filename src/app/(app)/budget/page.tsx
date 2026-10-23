"use client";

import { useState } from "react";
import { Lock, Plus, Wallet } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import {
  addRevenueLine,
  closeMonthlyExpenseSheet,
  createMonthlyExpenseSheet,
  deleteExpenseLine,
  deleteRevenueLine,
  getMonthlyExpenseSheetDetail,
  listMonthlyExpenseSheets,
  updateExpenseLine,
  updateRevenueLine,
} from "@/lib/api/expense";
import type {
  Expense,
  ExpenseLineInput,
  MonthlyExpenseSheet,
  RevenueLine,
  RevenueLineInput,
  SheetInput,
} from "@/lib/types/expense";
import { FINANCING_MODE_LABEL, type FinancingMode } from "@/lib/types/budget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { Field, Input, Label, MoneyInput } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate, formatDateTime, formatGNF } from "@/lib/format";
import { submitExpenseLineOfflineAware } from "@/lib/offline/submit-expense-line";

export default function BudgetPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") || hasAnyPermission(user, ["depense:create"]);

  const sheetsQuery = useQuery(listMonthlyExpenseSheets, []);
  const sheets = sheetsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
          <Wallet className="h-6 w-6 text-brand-600" /> Dépenses
        </h1>
        {canWrite && (
          <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle dépense</Button>
        )}
      </Reveal>

      {sheetsQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : sheets.length === 0 ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Aucune fiche de dépense pour l&apos;instant. Créez-en une pour commencer.
        </p>
      ) : (
        <Card>
          <CardBody>
            <p className="mb-2 text-sm font-semibold text-gray-700">Historique</p>
            <Table>
              <THead>
                <tr><TH>Libellé</TH><TH>Année scolaire</TH><TH>Statut</TH><TH className="text-right">Créée le</TH></tr>
              </THead>
              <TBody>
                {sheets.map((s) => (
                  <TR key={s.id} className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                    <TD className="font-medium text-gray-900">{s.label}</TD>
                    <TD className="text-gray-500">{s.academicYear}</TD>
                    <TD>
                      {s.closedAt
                        ? <Badge tone="gray"><Lock className="mr-1 inline h-3 w-3" />Clôturée</Badge>
                        : <Badge tone="green">Ouverte</Badge>}
                    </TD>
                    <TD className="text-right text-gray-500">{formatDate(s.createdAt)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </CardBody>
        </Card>
      )}

      <Modal open={selectedId != null} onClose={() => setSelectedId(null)}
        title={sheets.find((s) => s.id === selectedId)?.label ?? "Fiche de dépense"} className="max-w-3xl">
        {selectedId != null && (
          <SheetDetailView sheetId={selectedId} canWrite={canWrite} tenantId={user?.tenantId ?? null}
            onSheetClosed={() => sheetsQuery.refetch()} />
        )}
      </Modal>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle fiche de dépense mensuelle">
        <SheetForm onCancel={() => setCreating(false)}
          onDone={(s) => { setCreating(false); notifySuccess("Fiche créée"); sheetsQuery.refetch(); setSelectedId(s.id); }} />
      </Modal>
    </div>
  );
}

function SheetDetailView({ sheetId, canWrite, tenantId, onSheetClosed }: {
  sheetId: number; canWrite: boolean; tenantId: number | null; onSheetClosed: () => void;
}) {
  const detailQuery = useQuery(() => getMonthlyExpenseSheetDetail(sheetId), [sheetId]);
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [addingRevenue, setAddingRevenue] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<RevenueLine | null>(null);

  if (detailQuery.loading || !detailQuery.data) {
    return <div className="flex justify-center py-10"><Spinner /></div>;
  }
  const { sheet, expenses, revenues, totalExpenses, totalRevenues } = detailQuery.data;
  const open = !sheet.closedAt && canWrite;

  function refresh() { detailQuery.refetch(); }

  function close() {
    confirmAction({
      title: "Clôturer la fiche",
      message: "Plus aucune ligne ne pourra être ajoutée, modifiée ou supprimée après clôture. Continuer ?",
      confirmLabel: "Clôturer",
      onConfirm: async () => {
        try { await closeMonthlyExpenseSheet(sheetId); notifySuccess("Fiche clôturée"); refresh(); onSheetClosed(); }
        catch (e) { notifyError(e); }
      },
    });
  }

  function removeExpense(e: Expense) {
    confirmAction({
      title: "Supprimer la ligne", message: `Supprimer « ${e.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteExpenseLine(e.id); notifySuccess("Ligne supprimée"); refresh(); } catch (err) { notifyError(err); } },
    });
  }
  function removeRevenue(r: RevenueLine) {
    confirmAction({
      title: "Supprimer la ligne", message: `Supprimer « ${r.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteRevenueLine(r.id); notifySuccess("Ligne supprimée"); refresh(); } catch (err) { notifyError(err); } },
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span>{sheet.academicYear}</span>
          {sheet.closedAt
            ? <Badge tone="gray"><Lock className="mr-1 inline h-3 w-3" />Clôturée le {formatDateTime(sheet.closedAt)}</Badge>
            : <Badge tone="green">Ouverte</Badge>}
        </div>
        {open && <Button size="sm" variant="secondary" onClick={close}>Clôturer la fiche</Button>}
      </div>

      {sheet.financingMode && sheet.financingMode !== "NONE" && (
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <strong>Financement :</strong> {FINANCING_MODE_LABEL[sheet.financingMode]}
          {sheet.financingAmount ? ` — ${formatGNF(sheet.financingAmount)}` : ""}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Card><CardBody>
          <p className="text-xs font-semibold uppercase tracking-wide text-error-600">Total dépenses</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatGNF(totalExpenses)}</p>
        </CardBody></Card>
        <Card><CardBody>
          <p className="text-xs font-semibold uppercase tracking-wide text-success-600">Total recettes</p>
          <p className="mt-1 text-lg font-bold text-gray-900">{formatGNF(totalRevenues)}</p>
        </CardBody></Card>
      </div>

      <Card>
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Dépenses</h3>
            {open && <Button size="sm" variant="ghost" onClick={() => setAddingExpense(true)} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
          </div>
          {expenses.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Aucune dépense saisie.</p>
          ) : (
            <Table>
              <THead><tr><TH>Article</TH><TH>Nécessaire</TH><TH className="text-right">Montant</TH><TH /></tr></THead>
              <TBody>
                {expenses.map((e) => (
                  <TR key={e.id}>
                    <TD className="font-medium text-gray-900">
                      {e.label}
                      <span className="block text-xs text-gray-400">{formatDate(e.expenseDate)}</span>
                    </TD>
                    <TD>{e.necessary ? <Badge tone="amber">Nécessaire</Badge> : <span className="text-xs text-gray-400">—</span>}</TD>
                    <TD className="text-right">{formatGNF(e.amount)}</TD>
                    <TD className="text-right">{open && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingExpense(e)}>Modifier</Button>
                        <Button size="sm" variant="ghost" className="text-error-600" onClick={() => removeExpense(e)}>Suppr.</Button>
                      </div>
                    )}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Recettes</h3>
            {open && <Button size="sm" variant="ghost" onClick={() => setAddingRevenue(true)} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
          </div>
          <p className="mb-2 text-xs text-gray-400">Pour les budgets d&apos;événement (sortie, kermesse, vente…) — indépendant des frais scolaires classiques.</p>
          {revenues.length === 0 ? (
            <p className="py-4 text-center text-sm text-gray-400">Aucune recette saisie.</p>
          ) : (
            <Table>
              <THead><tr><TH>Article</TH><TH className="text-right">Montant</TH><TH /></tr></THead>
              <TBody>
                {revenues.map((r) => (
                  <TR key={r.id}>
                    <TD className="font-medium text-gray-900">
                      {r.label}
                      <span className="block text-xs text-gray-400">{formatDate(r.revenueDate)}</span>
                    </TD>
                    <TD className="text-right">{formatGNF(r.amount)}</TD>
                    <TD className="text-right">{open && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setEditingRevenue(r)}>Modifier</Button>
                        <Button size="sm" variant="ghost" className="text-error-600" onClick={() => removeRevenue(r)}>Suppr.</Button>
                      </div>
                    )}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={addingExpense || editingExpense != null} onClose={() => { setAddingExpense(false); setEditingExpense(null); }}
        title={editingExpense ? "Modifier la dépense" : "Ajouter une dépense"}>
        <ExpenseLineForm initial={editingExpense}
          onCancel={() => { setAddingExpense(false); setEditingExpense(null); }}
          onDone={async (input) => {
            try {
              if (editingExpense) {
                await updateExpenseLine(editingExpense.id, input);
                setAddingExpense(false); setEditingExpense(null);
                notifySuccess("Dépense mise à jour");
                refresh();
                return;
              }
              // Hors-ligne (desktop) : la dépense est mise en file locale et synchronisée au retour du
              // réseau, au lieu d'échouer silencieusement (§retour comptable).
              const attempt = await submitExpenseLineOfflineAware(tenantId, sheetId, input);
              setAddingExpense(false); setEditingExpense(null);
              if (attempt.outcome === "queued-desktop") {
                notifySuccess("Hors ligne : dépense enregistrée localement, sera synchronisée au retour du réseau");
              } else {
                notifySuccess("Dépense ajoutée");
              }
              refresh();
            } catch (e) { notifyError(e); }
          }} />
      </Modal>

      <Modal open={addingRevenue || editingRevenue != null} onClose={() => { setAddingRevenue(false); setEditingRevenue(null); }}
        title={editingRevenue ? "Modifier la recette" : "Ajouter une recette"}>
        <RevenueLineForm initial={editingRevenue}
          onCancel={() => { setAddingRevenue(false); setEditingRevenue(null); }}
          onDone={async (input) => {
            try {
              if (editingRevenue) await updateRevenueLine(editingRevenue.id, input);
              else await addRevenueLine(sheetId, input);
              setAddingRevenue(false); setEditingRevenue(null);
              notifySuccess(editingRevenue ? "Recette mise à jour" : "Recette ajoutée");
              refresh();
            } catch (e) { notifyError(e); }
          }} />
      </Modal>
    </div>
  );
}

function SheetForm({ onCancel, onDone }: { onCancel: () => void; onDone: (s: MonthlyExpenseSheet) => void }) {
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [financingMode, setFinancingMode] = useState<FinancingMode>("NONE");
  const [financingAmount, setFinancingAmount] = useState("0");

  async function submit() {
    if (!label.trim() || !academicYear.trim()) { notifyError("Libellé et année scolaire requis"); return; }
    setLoading(true);
    try {
      const payload: SheetInput = {
        label, academicYear, financingMode,
        financingAmount: financingMode !== "NONE" ? Number(financingAmount) || 0 : null,
      };
      onDone(await createMonthlyExpenseSheet(payload));
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input placeholder="Dépense du mois d'Octobre" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field>
        <Label>Année scolaire <span className="text-error-500">*</span></Label>
        <Input placeholder="2025-2026" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Financement</Label>
          <p className="text-xs text-gray-400">Si un événement dépasse la trésorerie courante</p>
          <Select value={financingMode} onChange={(e) => setFinancingMode(e.target.value as FinancingMode)}>
            {(Object.keys(FINANCING_MODE_LABEL) as FinancingMode[]).map((m) => (<option key={m} value={m}>{FINANCING_MODE_LABEL[m]}</option>))}
          </Select>
        </Field>
        {financingMode !== "NONE" && (
          <Field>
            <Label>Montant à {financingMode === "COLLECTE" ? "collecter" : "emprunter"}</Label>
            <MoneyInput value={financingAmount} onValueChange={(n) => setFinancingAmount(String(n))} />
          </Field>
        )}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>Créer</Button>
      </div>
    </div>
  );
}

function ExpenseLineForm({ initial, onCancel, onDone }: {
  initial?: Expense | null; onCancel: () => void; onDone: (input: ExpenseLineInput) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(Number(initial.amount)) : "0");
  const [necessary, setNecessary] = useState(initial?.necessary ?? false);
  const [expenseDate, setExpenseDate] = useState(initial?.expenseDate ?? "");

  function submit() {
    if (!label.trim()) { notifyError("Le libellé est requis"); return; }
    if (Number(amount) <= 0) { notifyError("Le montant doit être positif"); return; }
    onDone({ label, amount: Number(amount), necessary, expenseDate: expenseDate || null });
  }

  return (
    <div className="space-y-4">
      <Field>
        <Label>Article <span className="text-error-500">*</span></Label>
        <Input placeholder="Craie, réparation, transport…" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field><Label>Montant dépensé</Label><MoneyInput value={amount} onValueChange={(n) => setAmount(String(n))} /></Field>
      <Field><Label>Date</Label><DatePicker value={expenseDate} onChange={setExpenseDate} /></Field>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="necessary" checked={necessary} onChange={(e) => setNecessary(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
        <label htmlFor="necessary" className="cursor-pointer text-sm text-gray-700">Dépense nécessaire</label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit}>{initial ? "Enregistrer" : "Ajouter"}</Button>
      </div>
    </div>
  );
}

function RevenueLineForm({ initial, onCancel, onDone }: {
  initial?: RevenueLine | null; onCancel: () => void; onDone: (input: RevenueLineInput) => void;
}) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [amount, setAmount] = useState(initial?.amount != null ? String(Number(initial.amount)) : "0");
  const [revenueDate, setRevenueDate] = useState(initial?.revenueDate ?? "");

  function submit() {
    if (!label.trim()) { notifyError("Le libellé est requis"); return; }
    if (Number(amount) <= 0) { notifyError("Le montant doit être positif"); return; }
    onDone({ label, amount: Number(amount), revenueDate: revenueDate || null });
  }

  return (
    <div className="space-y-4">
      <Field>
        <Label>Article <span className="text-error-500">*</span></Label>
        <Input placeholder="Vente de tickets, dons…" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field><Label>Montant</Label><MoneyInput value={amount} onValueChange={(n) => setAmount(String(n))} /></Field>
      <Field><Label>Date</Label><DatePicker value={revenueDate} onChange={setRevenueDate} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit}>{initial ? "Enregistrer" : "Ajouter"}</Button>
      </div>
    </div>
  );
}

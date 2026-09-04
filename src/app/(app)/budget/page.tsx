"use client";

import { useMemo, useState } from "react";
import { FileText, Plus, Wallet } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import {
  addBudgetLine,
  updateBudgetLine,
  approveBudget,
  closeBudget,
  createBudget,
  updateBudget,
  deleteBudget,
  deleteBudgetLine,
  getBudgetLines,
  getBudgetPdfObjectUrl,
  getBudgetSummary,
  listBudgets,
  rejectBudget,
  submitBudget,
} from "@/lib/api/budget";
import {
  BUDGET_LINE_TYPE_LABEL,
  BUDGET_STATUS_LABEL,
  FINANCING_MODE_LABEL,
  type AnnualBudget,
  type BudgetLine,
  type BudgetLineType,
  type FinancingMode,
} from "@/lib/types/budget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Select } from "@/components/ui/select";
import { Field, Input, Label, MoneyInput, Textarea } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { FilePreview } from "@/components/ui/file-preview";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<string, "gray" | "green" | "amber" | "red" | "indigo"> = {
  DRAFT: "amber", SUBMITTED: "indigo", APPROVED: "green", REJECTED: "red", CLOSED: "gray",
};

export default function BudgetPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT") || hasAnyPermission(user, ["budget:manage"]);
  const canApprove = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["budget:approve"]);

  const budgetsQuery = useQuery(listBudgets, []);
  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const [selectedId, setSelectedId] = useState("");
  const selected = budgets.find((b) => String(b.id) === selectedId) ?? null;
  const [creating, setCreating] = useState(false);
  const budgetOptions: SearchableOption[] = useMemo(
    () => budgets.map((b) => {
      const label = `${b.label} (${b.academicYear})`;
      return { value: String(b.id), trigger: label, label, searchText: label };
    }),
    [budgets],
  );

  async function submit(b: AnnualBudget) {
    try { await submitBudget(b.id); notifySuccess("Budget soumis à la direction"); budgetsQuery.refetch(); } catch (e) { notifyError(e); }
  }
  async function approve(b: AnnualBudget) {
    try { await approveBudget(b.id); notifySuccess("Budget approuvé"); budgetsQuery.refetch(); } catch (e) { notifyError(e); }
  }
  async function reject(b: AnnualBudget, reason: string) {
    try { await rejectBudget(b.id, reason); notifySuccess("Budget rejeté"); budgetsQuery.refetch(); } catch (e) { notifyError(e); }
  }
  async function close(b: AnnualBudget) {
    try { await closeBudget(b.id); notifySuccess("Budget clôturé"); budgetsQuery.refetch(); } catch (e) { notifyError(e); }
  }
  function remove(b: AnnualBudget) {
    confirmAction({
      title: "Supprimer le budget", message: `Supprimer « ${b.label} » et ses lignes ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteBudget(b.id); setSelectedId(""); notifySuccess("Supprimé"); budgetsQuery.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-gray-900">
            <Wallet className="h-6 w-6 text-brand-600" /> Budget annuel
          </h1>
          <p className="text-sm text-gray-500">Recettes et dépenses prévisionnelles, suivi du prévu vs réalisé</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau budget</Button>}
      </Reveal>

      <div className="max-w-md">
        <Field>
          <Label>Budget</Label>
          <SearchableSelect value={selectedId} options={budgetOptions} onChange={setSelectedId} triggerClassName="w-full justify-between px-3" />
        </Field>
      </div>

      {budgetsQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !selected ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          {budgets.length === 0 ? "Aucun budget. Créez-en un pour commencer." : "Sélectionnez un budget."}
        </p>
      ) : (
        <BudgetDetail
          budget={selected} canWrite={canWrite} canApprove={canApprove}
          onSubmit={() => submit(selected)} onApprove={() => approve(selected)}
          onReject={(reason) => reject(selected, reason)} onClose={() => close(selected)} onDelete={() => remove(selected)}
          onChanged={() => budgetsQuery.refetch()}
        />
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau budget annuel">
        <BudgetForm onCancel={() => setCreating(false)} onDone={(b) => { setCreating(false); notifySuccess("Budget créé"); budgetsQuery.refetch(); setSelectedId(String(b.id)); }} />
      </Modal>
    </div>
  );
}

function BudgetDetail({ budget, canWrite, canApprove, onSubmit, onApprove, onReject, onClose, onDelete, onChanged }: {
  budget: AnnualBudget; canWrite: boolean; canApprove: boolean;
  onSubmit: () => void; onApprove: () => void; onReject: (reason: string) => void; onClose: () => void; onDelete: () => void; onChanged: () => void;
}) {
  const linesQuery = useQuery(() => getBudgetLines(budget.id), [budget.id, budget.status]);
  const summaryQuery = useQuery(() => getBudgetSummary(budget.id), [budget.id, budget.status]);
  const [adding, setAdding] = useState<BudgetLineType | null>(null);
  const [editingLine, setEditingLine] = useState<BudgetLine | null>(null);
  const [editingHeader, setEditingHeader] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<{ url: string | null; title: string } | null>(null);
  // Le comptable ne peut modifier les lignes qu'avant validation (brouillon ou rejeté).
  const editable = canWrite && (budget.status === "DRAFT" || budget.status === "REJECTED");

  function refresh() { linesQuery.refetch(); summaryQuery.refetch(); }
  function removeLine(l: BudgetLine) {
    confirmAction({
      title: "Supprimer la ligne", message: `Supprimer « ${l.category} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteBudgetLine(l.id); notifySuccess("Ligne supprimée"); refresh(); } catch (e) { notifyError(e); } },
    });
  }
  async function showPdf() {
    try {
      const url = await getBudgetPdfObjectUrl(budget.id);
      setPreview({ url, title: `Budget — ${budget.label}` });
    } catch (e) { notifyError(e); }
  }

  const lines = linesQuery.data ?? [];
  const revenue = lines.filter((l) => l.lineType === "REVENUE");
  const expense = lines.filter((l) => l.lineType === "EXPENSE");
  const s = summaryQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-gray-900">{budget.label}</h2>
          <Badge tone={STATUS_TONE[budget.status]}>{BUDGET_STATUS_LABEL[budget.status]}</Badge>
          <span className="text-sm text-gray-400">{budget.academicYear}</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" leftSection={<FileText className="h-4 w-4" />} onClick={showPdf}>PDF</Button>
          {editable && <Button size="sm" variant="ghost" onClick={() => setEditingHeader(true)}>Modifier</Button>}
          {editable && <Button size="sm" onClick={onSubmit}>Soumettre</Button>}
          {canApprove && budget.status === "SUBMITTED" && <Button size="sm" onClick={onApprove}>Approuver</Button>}
          {canApprove && budget.status === "SUBMITTED" && <Button size="sm" variant="secondary" onClick={() => { setReason(""); setRejecting(true); }}>Rejeter</Button>}
          {canApprove && budget.status === "APPROVED" && <Button size="sm" variant="secondary" onClick={onClose}>Clôturer</Button>}
          {canApprove && <Button size="sm" variant="ghost" className="text-error-600" onClick={onDelete}>Supprimer</Button>}
        </div>
      </div>

      {budget.financingMode && budget.financingMode !== "NONE" && (
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          <strong>Financement :</strong> {FINANCING_MODE_LABEL[budget.financingMode]}
          {budget.financingAmount ? ` — ${formatGNF(budget.financingAmount)}` : ""}
        </div>
      )}

      {budget.status === "REJECTED" && budget.rejectionReason && (
        <div className="rounded-lg bg-error-50 px-3 py-2 text-sm text-error-800">
          <strong>Budget rejeté par la direction :</strong> {budget.rejectionReason}
        </div>
      )}
      {budget.status === "SUBMITTED" && (
        <div className="rounded-lg bg-indigo-50 px-3 py-2 text-sm text-indigo-800">
          Budget soumis — en attente de validation par la direction.
        </div>
      )}

      {s && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SummaryCard title="Recettes" planned={s.plannedRevenue} actual={s.actualRevenue} toneClass="text-success-600" />
          <SummaryCard title="Dépenses" planned={s.plannedExpense} actual={s.actualExpense} toneClass="text-error-600" />
          <SummaryCard title="Solde" planned={s.plannedBalance} actual={s.actualBalance} toneClass="text-brand-600" />
        </div>
      )}

      <LineSection title="Recettes" type="REVENUE" lines={revenue} canWrite={editable}
        onAdd={() => setAdding("REVENUE")} onEdit={setEditingLine} onRemove={removeLine} />
      <LineSection title="Dépenses" type="EXPENSE" lines={expense} canWrite={editable}
        onAdd={() => setAdding("EXPENSE")} onEdit={setEditingLine} onRemove={removeLine} />

      <Modal open={adding != null || editingLine != null} onClose={() => { setAdding(null); setEditingLine(null); }}
        title={editingLine ? "Modifier la ligne" : adding === "REVENUE" ? "Ajouter une recette" : "Ajouter une dépense"}>
        {(adding || editingLine) && (
          <LineForm budgetId={budget.id} type={editingLine?.lineType ?? adding ?? "REVENUE"} initial={editingLine}
            onCancel={() => { setAdding(null); setEditingLine(null); }}
            onDone={() => { setAdding(null); setEditingLine(null); notifySuccess(editingLine ? "Ligne mise à jour" : "Ligne ajoutée"); refresh(); }} />
        )}
      </Modal>

      <Modal open={editingHeader} onClose={() => setEditingHeader(false)} title="Modifier le budget">
        <BudgetForm initial={budget} onCancel={() => setEditingHeader(false)}
          onDone={() => { setEditingHeader(false); notifySuccess("Budget mis à jour"); onChanged(); }} />
      </Modal>

      <Modal open={rejecting} onClose={() => setRejecting(false)} title="Rejeter le budget">
        <div className="space-y-4">
          <Field>
            <Label>Motif du rejet <span className="text-error-500">*</span></Label>
            <Textarea rows={3} placeholder="Expliquez pourquoi le budget est rejeté (le comptable pourra corriger et resoumettre)."
              value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>Annuler</Button>
            <Button variant="danger" disabled={!reason.trim()}
              onClick={() => { onReject(reason.trim()); setRejecting(false); }}>Rejeter</Button>
          </div>
        </div>
      </Modal>

      <FilePreview url={preview?.url ?? null} title={preview?.title} open={preview != null} onClose={() => setPreview(null)} />
    </div>
  );
}

function SummaryCard({ title, planned, actual, toneClass }: { title: string; planned: string; actual: string; toneClass: string }) {
  const variance = Number(actual) - Number(planned);
  return (
    <Card>
      <CardBody>
        <p className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>{title}</p>
        <p className="mt-1 text-lg font-bold text-gray-900">{formatGNF(actual)}</p>
        <p className="text-xs text-gray-500">Prévu : {formatGNF(planned)}</p>
        <p className={`text-xs ${variance >= 0 ? "text-success-600" : "text-error-600"}`}>
          Écart : {variance >= 0 ? "+" : ""}{formatGNF(String(variance))}
        </p>
      </CardBody>
    </Card>
  );
}

function LineSection({ title, type, lines, canWrite, onAdd, onEdit, onRemove }: {
  title: string; type: BudgetLineType; lines: BudgetLine[]; canWrite: boolean;
  onAdd: () => void; onEdit: (l: BudgetLine) => void; onRemove: (l: BudgetLine) => void;
}) {
  return (
    <Card>
      <CardBody>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
          {canWrite && <Button size="sm" variant="ghost" onClick={onAdd} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
        </div>
        {lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-400">Aucune ligne.</p>
        ) : (
          <Table>
            <THead><tr><TH>Catégorie</TH><TH className="text-right">Prévu</TH><TH className="text-right">Réalisé</TH><TH className="text-right">Écart</TH><TH /></tr></THead>
            <TBody>
              {lines.map((l) => {
                const v = Number(l.actualAmount) - Number(l.plannedAmount);
                return (
                  <TR key={l.id}>
                    <TD className="font-medium text-gray-900">
                      {l.category}
                      {l.quantity != null && l.unitPrice != null && (
                        <span className="block text-xs text-gray-400">{l.quantity} × {formatGNF(l.unitPrice)}</span>
                      )}
                      {l.notes ? <span className="block text-xs text-gray-400">{l.notes}</span> : null}
                    </TD>
                    <TD className="text-right">{formatGNF(l.plannedAmount)}</TD>
                    <TD className="text-right">{formatGNF(l.actualAmount)}</TD>
                    <TD className={`text-right text-sm ${(type === "REVENUE" ? v : -v) >= 0 ? "text-success-600" : "text-error-600"}`}>{v >= 0 ? "+" : ""}{formatGNF(String(v))}</TD>
                    <TD className="text-right">{canWrite && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(l)}>Modifier</Button>
                        <Button size="sm" variant="ghost" className="text-error-600" onClick={() => onRemove(l)}>Suppr.</Button>
                      </div>
                    )}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

function BudgetForm({ initial, onCancel, onDone }: { initial?: AnnualBudget | null; onCancel: () => void; onDone: (b: AnnualBudget) => void }) {
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState(initial?.label ?? "");
  const [academicYear, setAcademicYear] = useState(initial?.academicYear ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [financingMode, setFinancingMode] = useState<FinancingMode>(initial?.financingMode ?? "NONE");
  const [financingAmount, setFinancingAmount] = useState(initial?.financingAmount ? String(Number(initial.financingAmount)) : "0");
  async function submit() {
    if (!label.trim() || !academicYear.trim()) { notifyError("Libellé et année requis"); return; }
    setLoading(true);
    try {
      const payload = {
        label, academicYear, notes,
        financingMode,
        financingAmount: financingMode !== "NONE" ? Number(financingAmount) || 0 : null,
      };
      onDone(initial ? await updateBudget(initial.id, payload) : await createBudget(payload));
    }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <Field>
        <Label>Libellé <span className="text-error-500">*</span></Label>
        <Input placeholder="Budget 2025-2026, Budget kermesse…" value={label} onChange={(e) => setLabel(e.target.value)} />
      </Field>
      <Field>
        <Label>Année scolaire <span className="text-error-500">*</span></Label>
        <Input placeholder="2025-2026" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} />
      </Field>
      <Field><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Financement</Label>
          <p className="text-xs text-gray-400">Si un événement (kermesse, sortie…) dépasse la trésorerie courante</p>
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
        <Button type="button" onClick={submit} loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
      </div>
    </div>
  );
}

function LineForm({ budgetId, type, initial, onCancel, onDone }: {
  budgetId: number; type: BudgetLineType; initial?: BudgetLine | null; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(initial?.category ?? "");
  // Quantité × prix unitaire (optionnel — ex. « 50 chaises à louer ») : quand les deux sont
  // renseignés, le montant se calcule automatiquement plutôt que d'être ressaisi.
  const [useQuantity, setUseQuantity] = useState(initial?.quantity != null);
  const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : "1");
  const [unitPrice, setUnitPrice] = useState(initial?.unitPrice != null ? String(Number(initial.unitPrice)) : "0");
  const [plannedAmount, setPlannedAmount] = useState(initial?.plannedAmount != null ? String(Number(initial.plannedAmount)) : "0");
  const [actualAmount, setActualAmount] = useState(initial?.actualAmount != null ? String(Number(initial.actualAmount)) : "0");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const computedAmount = useQuantity ? (Number(quantity) || 0) * (Number(unitPrice) || 0) : Number(plannedAmount) || 0;

  async function submit() {
    if (!category.trim()) { notifyError("Catégorie requise"); return; }
    setLoading(true);
    try {
      const payload = {
        lineType: type, category,
        quantity: useQuantity ? Number(quantity) || 0 : null,
        unitPrice: useQuantity ? Number(unitPrice) || 0 : null,
        plannedAmount: computedAmount, actualAmount: Number(actualAmount) || 0,
        notes: notes || null,
      };
      if (initial) await updateBudgetLine(initial.id, payload);
      else await addBudgetLine(budgetId, payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{BUDGET_LINE_TYPE_LABEL[type]}</p>
      <Field>
        <Label>Catégorie / article <span className="text-error-500">*</span></Label>
        <Input placeholder={type === "REVENUE" ? "Frais de scolarité, subvention…" : "Chaises à louer, sonorisation, salaires…"} value={category} onChange={(e) => setCategory(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="use-quantity" checked={useQuantity} onChange={(e) => setUseQuantity(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
        <label htmlFor="use-quantity" className="cursor-pointer text-sm text-gray-700">Cet article se chiffre par quantité × prix unitaire</label>
      </div>
      {useQuantity ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field><Label>Quantité</Label><Input type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} /></Field>
          <Field><Label>Prix unitaire</Label><MoneyInput value={unitPrice} onValueChange={(n) => setUnitPrice(String(n))} /></Field>
        </div>
      ) : (
        <Field><Label>Montant prévu</Label><MoneyInput value={plannedAmount} onValueChange={(n) => setPlannedAmount(String(n))} /></Field>
      )}
      {useQuantity && (
        <p className="text-sm text-gray-500">Montant calculé : <strong className="text-gray-900">{formatGNF(computedAmount)}</strong></p>
      )}
      <Field><Label>Réalisé</Label><MoneyInput value={actualAmount} onValueChange={(n) => setActualAmount(String(n))} /></Field>
      <Field><Label>Notes</Label><Textarea rows={1} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button type="button" onClick={submit} loading={loading}>{initial ? "Enregistrer" : "Ajouter"}</Button>
      </div>
    </div>
  );
}

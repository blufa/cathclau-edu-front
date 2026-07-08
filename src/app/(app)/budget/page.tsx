"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { Plus, Wallet } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
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
  getBudgetSummary,
  listBudgets,
  rejectBudget,
  submitBudget,
} from "@/lib/api/budget";
import {
  BUDGET_LINE_TYPE_LABEL,
  BUDGET_STATUS_LABEL,
  type AnnualBudget,
  type BudgetLine,
  type BudgetLineType,
} from "@/lib/types/budget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE: Record<string, "gray" | "green" | "amber" | "red" | "indigo"> = {
  DRAFT: "amber", SUBMITTED: "indigo", APPROVED: "green", REJECTED: "red", CLOSED: "gray",
};

export default function BudgetPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "ACCOUNTANT");
  const canApprove = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const budgetsQuery = useQuery(listBudgets, []);
  const budgets = useMemo(() => budgetsQuery.data ?? [], [budgetsQuery.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = budgets.find((b) => String(b.id) === selectedId) ?? null;
  const [creating, setCreating] = useState(false);

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
      onConfirm: async () => { try { await deleteBudget(b.id); setSelectedId(null); notifySuccess("Supprimé"); budgetsQuery.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
            <Wallet className="h-6 w-6 text-brand-600" /> Budget annuel
          </h1>
          <p className="text-sm text-slate-500">Recettes et dépenses prévisionnelles, suivi du prévu vs réalisé</p>
        </div>
        {canWrite && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau budget</Button>}
      </Reveal>

      <div className="max-w-md">
        <MantineSelect
          label="Budget" placeholder="Choisir un budget" clearable
          data={budgets.map((b) => ({ value: String(b.id), label: `${b.label} (${b.academicYear})` }))}
          value={selectedId} onChange={setSelectedId}
        />
      </div>

      {budgetsQuery.loading ? (
        <div className="flex justify-center py-10"><Spinner /></div>
      ) : !selected ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
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
  // Le comptable ne peut modifier les lignes qu'avant validation (brouillon ou rejeté).
  const editable = canWrite && (budget.status === "DRAFT" || budget.status === "REJECTED");

  function refresh() { linesQuery.refetch(); summaryQuery.refetch(); }
  function removeLine(l: BudgetLine) {
    confirmAction({
      title: "Supprimer la ligne", message: `Supprimer « ${l.category} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteBudgetLine(l.id); notifySuccess("Ligne supprimée"); refresh(); } catch (e) { notifyError(e); } },
    });
  }

  const lines = linesQuery.data ?? [];
  const revenue = lines.filter((l) => l.lineType === "REVENUE");
  const expense = lines.filter((l) => l.lineType === "EXPENSE");
  const s = summaryQuery.data;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-900">{budget.label}</h2>
          <Badge tone={STATUS_TONE[budget.status]}>{BUDGET_STATUS_LABEL[budget.status]}</Badge>
          <span className="text-sm text-slate-400">{budget.academicYear}</span>
        </div>
        <div className="flex gap-2">
          {editable && <Button size="sm" variant="ghost" onClick={() => setEditingHeader(true)}>Modifier</Button>}
          {editable && <Button size="sm" onClick={onSubmit}>Soumettre</Button>}
          {canApprove && budget.status === "SUBMITTED" && <Button size="sm" onClick={onApprove}>Approuver</Button>}
          {canApprove && budget.status === "SUBMITTED" && <Button size="sm" variant="secondary" onClick={() => { setReason(""); setRejecting(true); }}>Rejeter</Button>}
          {canApprove && budget.status === "APPROVED" && <Button size="sm" variant="secondary" onClick={onClose}>Clôturer</Button>}
          {canApprove && <Button size="sm" variant="ghost" className="text-red-600" onClick={onDelete}>Supprimer</Button>}
        </div>
      </div>

      {budget.status === "REJECTED" && budget.rejectionReason && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
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
          <SummaryCard title="Recettes" planned={s.plannedRevenue} actual={s.actualRevenue} toneClass="text-emerald-600" />
          <SummaryCard title="Dépenses" planned={s.plannedExpense} actual={s.actualExpense} toneClass="text-red-600" />
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
        <Stack gap="md">
          <Textarea label="Motif du rejet" withAsterisk autosize minRows={3}
            placeholder="Expliquez pourquoi le budget est rejeté (le comptable pourra corriger et resoumettre)."
            value={reason} onChange={(e) => setReason(e.currentTarget.value)} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejecting(false)}>Annuler</Button>
            <Button className="!bg-red-600" disabled={!reason.trim()}
              onClick={() => { onReject(reason.trim()); setRejecting(false); }}>Rejeter</Button>
          </div>
        </Stack>
      </Modal>
    </div>
  );
}

function SummaryCard({ title, planned, actual, toneClass }: { title: string; planned: string; actual: string; toneClass: string }) {
  const variance = Number(actual) - Number(planned);
  return (
    <Card>
      <CardBody>
        <p className={`text-xs font-semibold uppercase tracking-wide ${toneClass}`}>{title}</p>
        <p className="mt-1 text-lg font-bold text-slate-900">{formatGNF(actual)}</p>
        <p className="text-xs text-slate-500">Prévu : {formatGNF(planned)}</p>
        <p className={`text-xs ${variance >= 0 ? "text-emerald-600" : "text-red-600"}`}>
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
          <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
          {canWrite && <Button size="sm" variant="ghost" onClick={onAdd} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
        </div>
        {lines.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">Aucune ligne.</p>
        ) : (
          <Table>
            <THead><tr><TH>Catégorie</TH><TH className="text-right">Prévu</TH><TH className="text-right">Réalisé</TH><TH className="text-right">Écart</TH><TH /></tr></THead>
            <TBody>
              {lines.map((l) => {
                const v = Number(l.actualAmount) - Number(l.plannedAmount);
                return (
                  <TR key={l.id}>
                    <TD className="font-medium text-slate-900">{l.category}{l.notes ? <span className="block text-xs text-slate-400">{l.notes}</span> : null}</TD>
                    <TD className="text-right">{formatGNF(l.plannedAmount)}</TD>
                    <TD className="text-right">{formatGNF(l.actualAmount)}</TD>
                    <TD className={`text-right text-sm ${(type === "REVENUE" ? v : -v) >= 0 ? "text-emerald-600" : "text-red-600"}`}>{v >= 0 ? "+" : ""}{formatGNF(String(v))}</TD>
                    <TD className="text-right">{canWrite && (
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onEdit(l)}>Modifier</Button>
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onRemove(l)}>Suppr.</Button>
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
  const form = useForm({
    mode: "controlled",
    initialValues: { academicYear: initial?.academicYear ?? "", label: initial?.label ?? "", notes: initial?.notes ?? "" },
    validate: { academicYear: (v) => (v ? null : "Requis"), label: (v) => (v ? null : "Requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try { onDone(initial ? await updateBudget(initial.id, values) : await createBudget(values)); }
    catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk placeholder="Budget 2025-2026" {...form.getInputProps("label")} />
        <TextInput label="Année scolaire" withAsterisk placeholder="2025-2026" {...form.getInputProps("academicYear")} />
        <Textarea label="Notes" autosize minRows={2} {...form.getInputProps("notes")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
        </div>
      </Stack>
    </form>
  );
}

function LineForm({ budgetId, type, initial, onCancel, onDone }: {
  budgetId: number; type: BudgetLineType; initial?: BudgetLine | null; onCancel: () => void; onDone: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      category: initial?.category ?? "",
      plannedAmount: (initial?.plannedAmount != null ? Number(initial.plannedAmount) : 0) as number | string,
      actualAmount: (initial?.actualAmount != null ? Number(initial.actualAmount) : 0) as number | string,
      notes: initial?.notes ?? "",
    },
    validate: { category: (v) => (v ? null : "Requis") },
  });
  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        lineType: type, category: values.category,
        plannedAmount: Number(values.plannedAmount) || 0, actualAmount: Number(values.actualAmount) || 0,
        notes: values.notes || null,
      };
      if (initial) await updateBudgetLine(initial.id, payload);
      else await addBudgetLine(budgetId, payload);
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }
  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <p className="text-sm text-slate-500">{BUDGET_LINE_TYPE_LABEL[type]}</p>
        <TextInput label="Catégorie" withAsterisk placeholder={type === "REVENUE" ? "Frais de scolarité, subvention…" : "Salaires, fournitures…"} {...form.getInputProps("category")} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Montant prévu (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("plannedAmount")} />
          <NumberInput label="Réalisé (GNF)" thousandSeparator=" " min={0} {...form.getInputProps("actualAmount")} />
        </div>
        <Textarea label="Notes" autosize minRows={1} {...form.getInputProps("notes")} />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Ajouter"}</Button>
        </div>
      </Stack>
    </form>
  );
}

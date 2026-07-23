"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createDecisionRule,
  deleteDecisionRule,
  listDecisionRules,
  updateDecisionRule,
} from "@/lib/api/grading";
import { listSubjects } from "@/lib/api/academics";
import {
  DECISION_CONDITION_LABEL,
  type DecisionConditionType,
  type DecisionRule,
  type DecisionRuleInput,
} from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: DecisionRuleInput = {
  name: "", conditionType: "OVERALL_AT_LEAST", threshold: 10, subjectId: null,
  minCount: null, decision: "", priority: 0, active: true,
};

// Conditions requiring a subject / a count, so the form shows the right fields.
const NEEDS_SUBJECT: DecisionConditionType[] = ["SUBJECT_BELOW"];
const NEEDS_COUNT: DecisionConditionType[] = ["SUBJECTS_BELOW_COUNT"];

export function DecisionRulesPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listDecisionRules, []);
  const subjectsQuery = useQuery(listSubjects, []);
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const subjectOptions: SearchableOption[] = useMemo(
    () => subjects.map((s) => ({ value: String(s.id), trigger: s.label, label: s.label, searchText: s.label })),
    [subjects],
  );

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<DecisionRule | null>(null);
  const [form, setForm] = useState<DecisionRuleInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: DecisionRule) {
    setEditing(r);
    setForm({
      name: r.name, conditionType: r.conditionType,
      threshold: r.threshold != null ? Number(r.threshold) : null,
      subjectId: r.subjectId, minCount: r.minCount, decision: r.decision,
      priority: r.priority, active: r.active, validFrom: r.validFrom, validTo: r.validTo,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.name.trim() || !form.decision.trim()) { notifyError(new Error("Nom et décision requis.")); return; }
    setSaving(true);
    try {
      if (editing) await updateDecisionRule(editing.id, form);
      else await createDecisionRule(form);
      notifySuccess("Règle de décision enregistrée.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(r: DecisionRule) {
    confirmAction({
      title: "Supprimer la règle", message: `Supprimer « ${r.name} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteDecisionRule(r.id); notifySuccess("Règle supprimée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm text-gray-500">SI condition ALORS décision — évaluées par priorité décroissante</p>
        {canWrite && <Button onClick={openCreate} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">Aucune règle de décision.</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Priorité</TH><TH>Nom</TH><TH>Condition</TH><TH>Décision</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((r) => (
              <TR key={r.id}>
                <TD>{r.priority}</TD>
                <TD className="font-medium text-gray-900">{r.name}</TD>
                <TD className="text-sm text-gray-600">
                  {DECISION_CONDITION_LABEL[r.conditionType]}{r.threshold != null ? ` (${r.threshold})` : ""}
                </TD>
                <TD><Badge tone="indigo">{r.decision}</Badge></TD>
                <TD><Badge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(r)} aria-label="Modifier" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(r)} aria-label="Supprimer" className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la règle" : "Nouvelle règle de décision"}>
        <div className="space-y-4">
          <Field>
            <Label>Nom <span className="text-error-500">*</span></Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Admission normale" />
          </Field>
          <Field>
            <Label>Condition <span className="text-error-500">*</span></Label>
            <Select value={form.conditionType} onChange={(e) => setForm({ ...form, conditionType: e.target.value as DecisionConditionType })}>
              {Object.entries(DECISION_CONDITION_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
            </Select>
          </Field>
          <Field>
            <Label>Seuil</Label>
            <Input type="number" min={0} step={0.5} value={form.threshold ?? ""} onChange={(e) => setForm({ ...form, threshold: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          {NEEDS_SUBJECT.includes(form.conditionType) && (
            <Field>
              <Label>Matière</Label>
              <SearchableSelect value={form.subjectId ? String(form.subjectId) : ""} options={subjectOptions}
                onChange={(v) => setForm({ ...form, subjectId: v ? Number(v) : null })} triggerClassName="w-full justify-between px-3" />
            </Field>
          )}
          {NEEDS_COUNT.includes(form.conditionType) && (
            <Field>
              <Label>Nombre de matières</Label>
              <Input type="number" min={1} value={form.minCount ?? ""} onChange={(e) => setForm({ ...form, minCount: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
          )}
          <Field>
            <Label>Décision (résultat) <span className="text-error-500">*</span></Label>
            <Input value={form.decision} onChange={(e) => setForm({ ...form, decision: e.target.value })} placeholder="ADMIS / REDOUBLE / EXCLU…" />
          </Field>
          <Field>
            <Label>Priorité</Label>
            <p className="text-xs text-gray-400">Plus élevé = évaluée en premier</p>
            <Input type="number" min={0} value={form.priority ?? 0} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })} />
          </Field>
          <div className="flex items-center gap-3">
            <Switch checked={form.active ?? true} onChange={(checked) => setForm({ ...form, active: checked })} ariaLabel="Active" />
            <span className="text-sm text-gray-700">Active</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Switch, TextInput } from "@mantine/core";
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
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: DecisionRuleInput = {
  name: "", conditionType: "OVERALL_AT_LEAST", threshold: 10, subjectId: null,
  minCount: null, decision: "", priority: 0, active: true,
};

/** Conditions requiring a subject / a count, so the form shows the right fields. */
const NEEDS_SUBJECT: DecisionConditionType[] = ["SUBJECT_BELOW"];
const NEEDS_COUNT: DecisionConditionType[] = ["SUBJECTS_BELOW_COUNT"];

export function DecisionRulesPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listDecisionRules, []);
  const subjectsQuery = useQuery(listSubjects, []);
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);

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
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">SI condition ALORS décision — évaluées par priorité décroissante</p>
        {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Aucune règle de décision.</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Priorité</TH><TH>Nom</TH><TH>Condition</TH><TH>Décision</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((r) => (
              <TR key={r.id}>
                <TD>{r.priority}</TD>
                <TD className="font-medium text-slate-900">{r.name}</TD>
                <TD className="text-sm text-slate-600">
                  {DECISION_CONDITION_LABEL[r.conditionType]}{r.threshold != null ? ` (${r.threshold})` : ""}
                </TD>
                <TD><Badge tone="indigo">{r.decision}</Badge></TD>
                <TD><Badge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(r)} aria-label="Modifier" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(r)} aria-label="Supprimer" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la règle" : "Nouvelle règle de décision"}>
        <Stack gap="md">
          <TextInput label="Nom" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} placeholder="Ex. Admission normale" />
          <MantineSelect
            label="Condition" required allowDeselect={false}
            data={Object.entries(DECISION_CONDITION_LABEL).map(([value, label]) => ({ value, label }))}
            value={form.conditionType}
            onChange={(v) => v && setForm({ ...form, conditionType: v as DecisionConditionType })}
          />
          <NumberInput label="Seuil" min={0} step={0.5} decimalScale={2} value={form.threshold ?? undefined} onChange={(v) => setForm({ ...form, threshold: typeof v === "number" ? v : null })} />
          {NEEDS_SUBJECT.includes(form.conditionType) && (
            <MantineSelect
              label="Matière" searchable
              data={subjects.map((s) => ({ value: String(s.id), label: s.label }))}
              value={form.subjectId ? String(form.subjectId) : null}
              onChange={(v) => setForm({ ...form, subjectId: v ? Number(v) : null })}
            />
          )}
          {NEEDS_COUNT.includes(form.conditionType) && (
            <NumberInput label="Nombre de matières" min={1} value={form.minCount ?? undefined} onChange={(v) => setForm({ ...form, minCount: typeof v === "number" ? v : null })} />
          )}
          <TextInput label="Décision (résultat)" required value={form.decision} onChange={(e) => setForm({ ...form, decision: e.currentTarget.value })} placeholder="ADMIS / REDOUBLE / EXCLU…" />
          <NumberInput label="Priorité" min={0} value={form.priority ?? 0} onChange={(v) => setForm({ ...form, priority: typeof v === "number" ? v : 0 })} description="Plus élevé = évaluée en premier" />
          <Switch label="Active" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.currentTarget.checked })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </Stack>
      </Modal>
    </div>
  );
}

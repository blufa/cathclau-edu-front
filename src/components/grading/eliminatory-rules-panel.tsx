"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Switch, TextInput } from "@mantine/core";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createEliminatoryRule,
  deleteEliminatoryRule,
  listEliminatoryRules,
  updateEliminatoryRule,
} from "@/lib/api/grading";
import { listSubjects } from "@/lib/api/academics";
import type { EliminatoryRule, EliminatoryRuleInput } from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: EliminatoryRuleInput = { subjectId: 0, threshold: 8, decisionLabel: "", active: true };

export function EliminatoryRulesPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listEliminatoryRules, []);
  const subjectsQuery = useQuery(listSubjects, []);
  const subjects = useMemo(() => subjectsQuery.data ?? [], [subjectsQuery.data]);
  const subjectName = (id: number) => subjects.find((s) => s.id === id)?.label ?? `Matière #${id}`;

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EliminatoryRule | null>(null);
  const [form, setForm] = useState<EliminatoryRuleInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: EliminatoryRule) {
    setEditing(r);
    setForm({ subjectId: r.subjectId, threshold: Number(r.threshold), decisionLabel: r.decisionLabel ?? "", active: r.active });
    setOpen(true);
  }

  async function submit() {
    if (!form.subjectId) { notifyError(new Error("Sélectionnez une matière.")); return; }
    setSaving(true);
    try {
      if (editing) await updateEliminatoryRule(editing.id, form);
      else await createEliminatoryRule(form);
      notifySuccess("Règle enregistrée.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(r: EliminatoryRule) {
    confirmAction({
      title: "Supprimer la règle", message: `Supprimer la règle éliminatoire de ${subjectName(r.subjectId)} ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteEliminatoryRule(r.id); notifySuccess("Règle supprimée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">Note en dessous de laquelle l&apos;élève est ajourné, par matière</p>
        {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Aucune règle éliminatoire.</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Matière</TH><TH>Seuil</TH><TH>Décision</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-slate-900">{subjectName(r.subjectId)}</TD>
                <TD>{r.threshold} / 20</TD>
                <TD className="text-sm text-slate-600">{r.decisionLabel || "—"}</TD>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la règle" : "Nouvelle règle éliminatoire"}>
        <Stack gap="md">
          <MantineSelect
            label="Matière" required
            data={subjects.map((s) => ({ value: String(s.id), label: s.label }))}
            value={form.subjectId ? String(form.subjectId) : null}
            onChange={(v) => setForm({ ...form, subjectId: v ? Number(v) : 0 })}
            searchable
          />
          <NumberInput label="Seuil éliminatoire (/20)" min={0} max={20} step={0.5} decimalScale={2} value={form.threshold} onChange={(v) => setForm({ ...form, threshold: typeof v === "number" ? v : 0 })} />
          <TextInput label="Libellé de décision" value={form.decisionLabel ?? ""} onChange={(e) => setForm({ ...form, decisionLabel: e.currentTarget.value })} placeholder="Ex. Ajourné (note éliminatoire)" />
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

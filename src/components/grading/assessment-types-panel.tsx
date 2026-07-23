"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createAssessmentType,
  deleteAssessmentType,
  listAssessmentTypes,
  updateAssessmentType,
} from "@/lib/api/grading";
import type { AssessmentTypeConfig, AssessmentTypeConfigInput } from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Field, Input, Label } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: AssessmentTypeConfigInput = {
  code: "", label: "", defaultCoefficient: 1, weight: 1, color: "#14b8a6", active: true,
};

export function AssessmentTypesPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listAssessmentTypes, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AssessmentTypeConfig | null>(null);
  const [form, setForm] = useState<AssessmentTypeConfigInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(t: AssessmentTypeConfig) {
    setEditing(t);
    setForm({
      code: t.code, label: t.label,
      defaultCoefficient: t.defaultCoefficient ? Number(t.defaultCoefficient) : 1,
      weight: t.weight ? Number(t.weight) : 1,
      color: t.color ?? "#14b8a6", active: t.active,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.code.trim() || !form.label.trim()) { notifyError(new Error("Code et libellé requis.")); return; }
    setSaving(true);
    try {
      if (editing) await updateAssessmentType(editing.id, form);
      else await createAssessmentType(form);
      notifySuccess("Type d'évaluation enregistré.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(t: AssessmentTypeConfig) {
    confirmAction({
      title: "Supprimer le type", message: `Supprimer « ${t.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteAssessmentType(t.id); notifySuccess("Type supprimé."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm text-gray-500">Types d&apos;évaluation propres à votre établissement</p>
        {canWrite && <Button onClick={openCreate} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">Aucun type configuré.</p>
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>Code</TH><TH>Libellé</TH><TH>Coef. défaut</TH><TH>Poids</TH><TH>Couleur</TH><TH>Statut</TH>
              {canWrite && <TH className="text-right">Actions</TH>}
            </TR>
          </THead>
          <TBody>
            {items.map((t) => (
              <TR key={t.id}>
                <TD className="font-mono text-xs">{t.code}</TD>
                <TD className="font-medium text-gray-900">{t.label}</TD>
                <TD>{t.defaultCoefficient ?? "—"}</TD>
                <TD>{t.weight ?? "—"}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full ring-1 ring-gray-200" style={{ backgroundColor: t.color ?? "#e2e8f0" }} />
                    <span className="text-xs text-gray-500">{t.color ?? "—"}</span>
                  </span>
                </TD>
                <TD><Badge tone={t.active ? "green" : "gray"}>{t.active ? "Actif" : "Inactif"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(t)} aria-label="Modifier" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(t)} aria-label="Supprimer" className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier le type" : "Nouveau type d'évaluation"}>
        <div className="space-y-4">
          <Field>
            <Label>Code <span className="text-error-500">*</span></Label>
            <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="DEVOIR" />
          </Field>
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Devoir surveillé" />
          </Field>
          <Field>
            <Label>Coefficient par défaut</Label>
            <Input type="number" min={0} step={0.5} value={form.defaultCoefficient ?? 1} onChange={(e) => setForm({ ...form, defaultCoefficient: Number(e.target.value) || 1 })} />
          </Field>
          <Field>
            <Label>Poids</Label>
            <Input type="number" min={0} step={0.5} value={form.weight ?? 1} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 1 })} />
          </Field>
          <Field>
            <Label>Couleur</Label>
            <div className="flex items-center gap-2">
              <input type="color" value={form.color ?? "#14b8a6"} onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />
              <Input value={form.color ?? "#14b8a6"} onChange={(e) => setForm({ ...form, color: e.target.value })} className="max-w-[140px]" />
            </div>
          </Field>
          <div className="flex items-center gap-3">
            <Switch checked={form.active ?? true} onChange={(checked) => setForm({ ...form, active: checked })} ariaLabel="Actif" />
            <span className="text-sm text-gray-700">Actif</span>
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

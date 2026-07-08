"use client";

import { useState } from "react";
import { ColorInput, NumberInput, Stack, Switch, TextInput } from "@mantine/core";
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
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">Types d&apos;évaluation propres à votre établissement</p>
        {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Aucun type configuré.</p>
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
                <TD className="font-medium text-slate-900">{t.label}</TD>
                <TD>{t.defaultCoefficient ?? "—"}</TD>
                <TD>{t.weight ?? "—"}</TD>
                <TD>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-3 w-3 rounded-full ring-1 ring-slate-200" style={{ backgroundColor: t.color ?? "#e2e8f0" }} />
                    <span className="text-xs text-slate-500">{t.color ?? "—"}</span>
                  </span>
                </TD>
                <TD><Badge tone={t.active ? "green" : "gray"}>{t.active ? "Actif" : "Inactif"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(t)} aria-label="Modifier" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(t)} aria-label="Supprimer" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier le type" : "Nouveau type d'évaluation"}>
        <Stack gap="md">
          <TextInput label="Code" required value={form.code} onChange={(e) => setForm({ ...form, code: e.currentTarget.value })} placeholder="DEVOIR" />
          <TextInput label="Libellé" required value={form.label} onChange={(e) => setForm({ ...form, label: e.currentTarget.value })} placeholder="Devoir surveillé" />
          <NumberInput label="Coefficient par défaut" min={0} step={0.5} decimalScale={2} value={form.defaultCoefficient ?? 1} onChange={(v) => setForm({ ...form, defaultCoefficient: typeof v === "number" ? v : 1 })} />
          <NumberInput label="Poids" min={0} step={0.5} decimalScale={2} value={form.weight ?? 1} onChange={(v) => setForm({ ...form, weight: typeof v === "number" ? v : 1 })} />
          <ColorInput label="Couleur" value={form.color ?? "#14b8a6"} onChange={(v) => setForm({ ...form, color: v })} />
          <Switch label="Actif" checked={form.active ?? true} onChange={(e) => setForm({ ...form, active: e.currentTarget.checked })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </Stack>
      </Modal>
    </div>
  );
}

"use client";

import { useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Switch, TextInput } from "@mantine/core";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createStaffChildBenefit,
  deleteStaffChildBenefit,
  listStaffChildBenefits,
  updateStaffChildBenefit,
} from "@/lib/api/billing";
import {
  FEE_TYPE_LABEL,
  type FeeType,
  type StaffChildBenefitPolicy,
  type StaffChildBenefitPolicyInput,
} from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: StaffChildBenefitPolicyInput = {
  label: "", coveredChildrenCount: 2, coveragePercent: 50, feeType: null, active: true,
};

export function StaffChildBenefitsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listStaffChildBenefits, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffChildBenefitPolicy | null>(null);
  const [form, setForm] = useState<StaffChildBenefitPolicyInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(p: StaffChildBenefitPolicy) {
    setEditing(p);
    setForm({
      label: p.label, coveredChildrenCount: p.coveredChildrenCount,
      coveragePercent: p.coveragePercent != null ? Number(p.coveragePercent) : null,
      feeType: p.feeType, active: p.active,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.label.trim()) { notifyError(new Error("Libellé requis.")); return; }
    setSaving(true);
    try {
      if (editing) await updateStaffChildBenefit(editing.id, form);
      else await createStaffChildBenefit(form);
      notifySuccess("Avantage enregistré.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(p: StaffChildBenefitPolicy) {
    confirmAction({
      title: "Supprimer l'avantage", message: `Supprimer « ${p.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteStaffChildBenefit(p.id); notifySuccess("Avantage supprimé."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">Prise en charge des frais pour les enfants des membres du personnel</p>
        {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Aucun avantage configuré.</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Libellé</TH><TH>Enfants couverts</TH><TH>Prise en charge</TH><TH>Frais</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((p) => (
              <TR key={p.id}>
                <TD className="font-medium text-slate-900">{p.label}</TD>
                <TD>{p.coveredChildrenCount ?? "—"}</TD>
                <TD>{p.coveragePercent ?? 0} %</TD>
                <TD className="text-sm text-slate-600">{p.feeType ? FEE_TYPE_LABEL[p.feeType] : "Tous"}</TD>
                <TD><Badge tone={p.active ? "green" : "gray"}>{p.active ? "Actif" : "Inactif"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(p)} aria-label="Modifier" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(p)} aria-label="Supprimer" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier l'avantage" : "Nouvel avantage personnel"}>
        <Stack gap="md">
          <TextInput label="Libellé" required value={form.label} onChange={(e) => setForm({ ...form, label: e.currentTarget.value })} placeholder="Ex. Enseignants — 50 % scolarité" />
          <NumberInput label="Nombre d'enfants couverts" min={1} value={form.coveredChildrenCount ?? undefined} onChange={(v) => setForm({ ...form, coveredChildrenCount: typeof v === "number" ? v : null })} />
          <NumberInput label="Prise en charge (%)" min={0} max={100} value={form.coveragePercent ?? undefined} onChange={(v) => setForm({ ...form, coveragePercent: typeof v === "number" ? v : null })} />
          <MantineSelect
            label="Type de frais concerné" clearable
            placeholder="Tous les frais"
            data={Object.entries(FEE_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            value={form.feeType}
            onChange={(v) => setForm({ ...form, feeType: (v as FeeType) ?? null })}
          />
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

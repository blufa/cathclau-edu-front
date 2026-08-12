"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createEarlyPaymentDiscountRule,
  deleteEarlyPaymentDiscountRule,
  listEarlyPaymentDiscountRules,
  updateEarlyPaymentDiscountRule,
} from "@/lib/api/billing";
import {
  FEE_TYPE_LABEL,
  type EarlyPaymentDiscountRule,
  type EarlyPaymentDiscountRuleInput,
  type FeeType,
} from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: EarlyPaymentDiscountRuleInput = {
  label: "", percentage: 5, feeType: "MONTHLY", active: true,
};

export function EarlyPaymentDiscountRulesPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listEarlyPaymentDiscountRules, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EarlyPaymentDiscountRule | null>(null);
  const [form, setForm] = useState<EarlyPaymentDiscountRuleInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: EarlyPaymentDiscountRule) {
    setEditing(r);
    setForm({
      label: r.label, percentage: r.percentage != null ? Number(r.percentage) : null,
      feeType: r.feeType, active: r.active,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.label.trim()) { notifyError(new Error("Libellé requis.")); return; }
    setSaving(true);
    try {
      if (editing) await updateEarlyPaymentDiscountRule(editing.id, form);
      else await createEarlyPaymentDiscountRule(form);
      notifySuccess("Remise année complète enregistrée.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(r: EarlyPaymentDiscountRule) {
    confirmAction({
      title: "Supprimer la remise", message: `Supprimer « ${r.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteEarlyPaymentDiscountRule(r.id); notifySuccess("Remise supprimée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">
          Réduction accordée quand un parent règle en un seul paiement toutes les tranches restantes d&apos;un frais
        </p>
        {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Aucune remise configurée.</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Libellé</TH><TH>Remise</TH><TH>Frais</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-slate-900">{r.label}</TD>
                <TD>{r.percentage ?? 0} %</TD>
                <TD className="text-sm text-slate-600">{r.feeType ? FEE_TYPE_LABEL[r.feeType] : "Tous"}</TD>
                <TD><Badge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(r)} aria-label="Modifier" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(r)} aria-label="Supprimer" className="rounded-lg p-1.5 text-slate-500 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la remise" : "Nouvelle remise année complète"}>
        <div className="space-y-4">
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex. Scolarité payée d'avance" />
          </Field>
          <Field>
            <Label>Remise (%)</Label>
            <Input type="number" min={0} max={100} value={form.percentage ?? ""} onChange={(e) => setForm({ ...form, percentage: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field>
            <Label>Type de frais concerné</Label>
            <Select value={form.feeType ?? ""} onChange={(e) => setForm({ ...form, feeType: (e.target.value as FeeType) || null })}>
              <option value="">Tous les frais</option>
              {Object.entries(FEE_TYPE_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
            </Select>
          </Field>
          <div className="flex items-center gap-3">
            <Switch checked={form.active ?? true} onChange={(checked) => setForm({ ...form, active: checked })} ariaLabel="Active" />
            <span className="text-sm text-gray-700">Active</span>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

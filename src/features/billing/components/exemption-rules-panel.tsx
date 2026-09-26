"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createExemptionRule,
  deleteExemptionRule,
  listExemptionRules,
  updateExemptionRule,
} from "@/lib/api/billing";
import {
  EXEMPTION_TYPE_LABEL,
  FEE_TYPE_LABEL,
  type ExemptionRule,
  type ExemptionRuleInput,
  type ExemptionType,
} from "@/lib/types/billing";
import { FeeTypeMultiSelect } from "@/components/billing/fee-type-multi-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: ExemptionRuleInput = {
  label: "", type: "PARTIAL", percentage: 50, amount: null, feeTypes: [], staffBenefit: false, active: true,
};

/**
 * Catalogue des types d'exonération pré-configurés (§retour comptable, refonte inscription) — ex.
 * "Orphelin — 100%", "Réduction sociale — 50%". Une fois configurés ici, ils sont proposés dans une
 * liste déroulante à l'inscription, au lieu d'être ressaisis au cas par cas pour chaque élève.
 */
export function ExemptionRulesPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listExemptionRules, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ExemptionRule | null>(null);
  const [form, setForm] = useState<ExemptionRuleInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: ExemptionRule) {
    setEditing(r);
    setForm({
      label: r.label, type: r.type,
      percentage: r.percentage != null ? Number(r.percentage) : null,
      amount: r.amount != null ? Number(r.amount) : null,
      feeTypes: r.feeTypes ?? [], staffBenefit: r.staffBenefit, active: r.active,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.label.trim()) { notifyError(new Error("Libellé requis.")); return; }
    setSaving(true);
    try {
      if (editing) await updateExemptionRule(editing.id, form);
      else await createExemptionRule(form);
      notifySuccess("Type d'exonération enregistré.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(r: ExemptionRule) {
    confirmAction({
      title: "Supprimer le type d'exonération", message: `Supprimer « ${r.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteExemptionRule(r.id); notifySuccess("Supprimé."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">Types d&apos;exonération réutilisables, proposés dans une liste à l&apos;inscription</p>
        {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Aucun type d&apos;exonération configuré.</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Libellé</TH><TH>Type</TH><TH>Montant</TH><TH>Frais</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((r) => (
              <TR key={r.id}>
                <TD className="font-medium text-slate-900">
                  {r.label}
                  {r.staffBenefit && <Badge tone="blue" className="ml-2">Avantage personnel</Badge>}
                </TD>
                <TD>{EXEMPTION_TYPE_LABEL[r.type]}</TD>
                <TD>{r.percentage != null ? `${r.percentage} %` : r.amount != null ? formatGNF(r.amount) : "—"}</TD>
                <TD className="text-sm text-slate-600">
                  {r.feeTypes && r.feeTypes.length > 0 ? r.feeTypes.map((t) => FEE_TYPE_LABEL[t]).join(", ") : "Tous"}
                </TD>
                <TD><Badge tone={r.active ? "green" : "gray"}>{r.active ? "Actif" : "Inactif"}</Badge></TD>
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

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier le type d'exonération" : "Nouveau type d'exonération"}>
        <div className="space-y-4">
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex. Orphelin, Réduction sociale…" />
          </Field>
          <Field>
            <Label>Type</Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExemptionType })}>
              {Object.entries(EXEMPTION_TYPE_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
            </Select>
          </Field>
          {form.type !== "EXCEPTIONAL" ? (
            <Field>
              <Label>Pourcentage (%)</Label>
              <Input type="number" min={0} max={100} value={form.percentage ?? ""} onChange={(e) => setForm({ ...form, percentage: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
          ) : (
            <Field>
              <Label>Montant fixe (GNF)</Label>
              <Input type="number" min={0} value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? null : Number(e.target.value) })} />
            </Field>
          )}
          <FeeTypeMultiSelect value={form.feeTypes} onChange={(v) => setForm({ ...form, feeTypes: v })} />
          <div className="flex items-center gap-3">
            <Switch checked={form.staffBenefit ?? false} onChange={(checked) => setForm({ ...form, staffBenefit: checked })} ariaLabel="Avantage personnel" />
            <span className="text-sm text-gray-700">Avantage personnel (retenue sur salaire du parent employé)</span>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={form.active ?? true} onChange={(checked) => setForm({ ...form, active: checked })} ariaLabel="Actif" />
            <span className="text-sm text-gray-700">Actif</span>
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

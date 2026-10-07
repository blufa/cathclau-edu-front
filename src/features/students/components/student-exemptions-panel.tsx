"use client";

import { useState } from "react";
import { Plus, Ban, BadgePercent } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { grantExemption, listExemptionsByStudent, revokeExemption } from "@/lib/api/billing";
import {
  EXEMPTION_TYPE_LABEL,
  FEE_TYPE_LABEL,
  type Exemption,
  type ExemptionInput,
  type ExemptionType,
} from "@/lib/types/billing";
import { FeeTypeMultiSelect } from "@/components/billing/fee-type-multi-select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Input, Label, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

function emptyInput(studentId: number): ExemptionInput {
  return { studentId, type: "PARTIAL", percentage: null, amount: null, feeTypes: [], reason: "", startDate: null, endDate: null, staffBenefit: false };
}

/**
 * Accorder/consulter les exonérations de CET élève, directement depuis sa fiche — sans ça, le
 * comptable devait aller chercher l'élève une seconde fois sur /invoices/rules (§retour comptable :
 * "je ne vois pas où aller mettre l'exonération"). Ne touche jamais aux factures déjà générées —
 * l'exonération ne s'applique qu'à la prochaine génération (voir ExemptionService#computeApplicable
 * côté backend) : pour un oubli corrigé après coup, il faut d'abord supprimer les factures erronées
 * (bouton "Supprimer" ci-dessous, tant qu'impayées) puis régénérer une fois l'exonération accordée.
 */
export function StudentExemptionsPanel({ studentId }: { studentId: number }) {
  const { user } = useAuth();
  const canCreate = hasAnyPermission(user, ["exoneration:create"]);
  const canRevoke = hasAnyPermission(user, ["exoneration:delete"]);
  const q = useQuery(() => listExemptionsByStudent(studentId), [studentId]);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExemptionInput>(emptyInput(studentId));
  const [saving, setSaving] = useState(false);

  function openCreate() { setForm(emptyInput(studentId)); setOpen(true); }

  async function submit() {
    if (!form.reason || !form.reason.trim()) { notifyError(new Error("Le motif est requis.")); return; }
    setSaving(true);
    try {
      await grantExemption(form);
      notifySuccess("Exonération accordée. Si des factures erronées existaient déjà, supprimez-les puis régénérez pour qu'elle s'applique.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function revoke(e: Exemption) {
    confirmAction({
      title: "Révoquer l'exonération", message: "Révoquer cette exonération ?", confirmLabel: "Révoquer", danger: true,
      onConfirm: async () => {
        try { await revokeExemption(e.id); notifySuccess("Exonération révoquée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-700">
          <BadgePercent className="h-4 w-4 text-brand-600" /> Exonérations de cet élève
        </p>
        {canCreate && <Button size="sm" onClick={openCreate}><Plus className="mr-1 h-3.5 w-3.5" /> Accorder</Button>}
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-4 text-sm text-slate-400">Aucune exonération pour cet élève.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div>
                <span className="font-medium text-slate-900">{EXEMPTION_TYPE_LABEL[e.type]}</span>
                {e.staffBenefit && <Badge tone="indigo" className="ml-1.5">Avantage personnel</Badge>}
                <Badge tone={e.active ? "green" : "gray"} className="ml-1.5">{e.active ? "Active" : "Révoquée"}</Badge>
                <p className="mt-0.5 text-xs text-slate-500">
                  {e.percentage != null ? `${e.percentage} %` : e.amount != null ? formatGNF(e.amount) : "—"}
                  {" · "}
                  {e.feeTypes && e.feeTypes.length > 0 ? e.feeTypes.map((t) => FEE_TYPE_LABEL[t]).join(", ") : "Tous les frais"}
                  {" · "}
                  {formatDate(e.startDate)}{e.endDate ? ` → ${formatDate(e.endDate)}` : ""}
                </p>
                {e.reason && <p className="mt-0.5 text-xs text-slate-400">{e.reason}</p>}
              </div>
              {canRevoke && e.active && (
                <button onClick={() => revoke(e)} aria-label="Révoquer" className="shrink-0 rounded-lg p-1.5 text-slate-500 hover:bg-error-50 hover:text-error-600">
                  <Ban className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Accorder une exonération">
        <div className="space-y-4">
          <Field>
            <Label>Type <span className="text-error-500">*</span></Label>
            <Select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as ExemptionType })}>
              {Object.entries(EXEMPTION_TYPE_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
            </Select>
          </Field>
          <Field>
            <Label>Pourcentage (%)</Label>
            <Input type="number" min={0} max={100} value={form.percentage ?? ""} onChange={(e) => setForm({ ...form, percentage: e.target.value === "" ? null : Number(e.target.value) })} />
            <p className="text-xs text-gray-400">Ou renseignez un montant fixe ci-dessous</p>
          </Field>
          <Field>
            <Label>Montant fixe (GNF)</Label>
            <Input type="number" min={0} value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <FeeTypeMultiSelect value={form.feeTypes} onChange={(v) => setForm({ ...form, feeTypes: v })} />
          <div className="flex items-center gap-3">
            <Switch checked={form.staffBenefit ?? false} onChange={(checked) => setForm({ ...form, staffBenefit: checked })} ariaLabel="Avantage personnel" />
            <span className="text-sm text-gray-700">Avantage personnel (retenue sur salaire du parent employé)</span>
          </div>
          <Field>
            <Label>Motif <span className="text-error-500">*</span></Label>
            <Textarea rows={2} value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="Raison de l'exonération…" />
          </Field>
          <Field>
            <Label>Début</Label>
            <DatePicker value={form.startDate ?? ""} onChange={(v) => setForm({ ...form, startDate: v || null })} clearable />
          </Field>
          <Field>
            <Label>Fin (optionnel)</Label>
            <DatePicker value={form.endDate ?? ""} onChange={(v) => setForm({ ...form, endDate: v || null })} clearable />
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Accorder"}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

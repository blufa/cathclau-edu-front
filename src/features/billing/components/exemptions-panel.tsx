"use client";

import { useMemo, useState } from "react";
import { Plus, Ban } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { grantExemption, listExemptions, revokeExemption } from "@/lib/api/billing";
import { searchStudents } from "@/lib/api/students";
import {
  EXEMPTION_TYPE_LABEL,
  FEE_TYPE_LABEL,
  type Exemption,
  type ExemptionInput,
  type ExemptionType,
  type FeeType,
} from "@/lib/types/billing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Input, Label, Field, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatGNF } from "@/lib/format";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const EMPTY: ExemptionInput = {
  studentId: 0, type: "PARTIAL", percentage: null, amount: null, feeType: null, reason: "", startDate: null, endDate: null,
};

export function ExemptionsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listExemptions, []);
  const studentsQuery = useQuery(() => searchStudents({ size: 1000 }), []);
  const students = useMemo(() => studentsQuery.data?.content ?? [], [studentsQuery.data]);
  const studentName = (id: number) => {
    const s = students.find((st) => st.id === id);
    return s ? `${s.firstName} ${s.lastName}` : `Élève #${id}`;
  };
  const studentOptions: SearchableOption[] = useMemo(
    () => students.map((s) => {
      const name = `${s.firstName} ${s.lastName}`;
      return { value: String(s.id), trigger: name, label: name, searchText: name };
    }),
    [students],
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<ExemptionInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setForm(EMPTY); setOpen(true); }

  async function submit() {
    if (!form.studentId) { notifyError(new Error("Sélectionnez un élève.")); return; }
    setSaving(true);
    try {
      await grantExemption(form);
      notifySuccess("Exonération accordée.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function revoke(e: Exemption) {
    confirmAction({
      title: "Révoquer l'exonération", message: `Révoquer l'exonération de ${studentName(e.studentId)} ?`, confirmLabel: "Révoquer", danger: true,
      onConfirm: async () => {
        try { await revokeExemption(e.id); notifySuccess("Exonération révoquée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <p className="text-sm text-slate-500">Exonérations totales, partielles ou exceptionnelles accordées aux élèves</p>
        {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Accorder</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Aucune exonération.</p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Élève</TH><TH>Type</TH><TH>Montant</TH><TH>Frais</TH><TH>Période</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-slate-900">{studentName(e.studentId)}</TD>
                <TD><Badge tone="blue">{EXEMPTION_TYPE_LABEL[e.type]}</Badge></TD>
                <TD>{e.percentage != null ? `${e.percentage} %` : e.amount != null ? formatGNF(e.amount) : "—"}</TD>
                <TD className="text-sm text-slate-600">{e.feeType ? FEE_TYPE_LABEL[e.feeType] : "Tous"}</TD>
                <TD className="text-sm text-slate-500">{formatDate(e.startDate)}{e.endDate ? ` → ${formatDate(e.endDate)}` : ""}</TD>
                <TD><Badge tone={e.active ? "green" : "gray"}>{e.active ? "Active" : "Révoquée"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    {e.active && (
                      <button onClick={() => revoke(e)} aria-label="Révoquer" className="rounded-lg p-1.5 text-slate-500 hover:bg-error-50 hover:text-error-600"><Ban className="h-4 w-4" /></button>
                    )}
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Accorder une exonération">
        <div className="space-y-4">
          <Field>
            <Label>Élève <span className="text-error-500">*</span></Label>
            <SearchableSelect
              value={form.studentId ? String(form.studentId) : ""}
              options={studentOptions}
              onChange={(v) => setForm({ ...form, studentId: v ? Number(v) : 0 })}
              triggerClassName="w-full justify-between px-3"
            />
          </Field>
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
          <Field>
            <Label>Type de frais concerné</Label>
            <Select value={form.feeType ?? ""} onChange={(e) => setForm({ ...form, feeType: (e.target.value as FeeType) || null })}>
              <option value="">Tous les frais</option>
              {Object.entries(FEE_TYPE_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
            </Select>
          </Field>
          <Field>
            <Label>Motif</Label>
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

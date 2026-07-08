"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Textarea } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
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
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate } from "@/lib/format";
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
                <TD>{e.percentage != null ? `${e.percentage} %` : e.amount != null ? `${e.amount}` : "—"}</TD>
                <TD className="text-sm text-slate-600">{e.feeType ? FEE_TYPE_LABEL[e.feeType] : "Tous"}</TD>
                <TD className="text-sm text-slate-500">{formatDate(e.startDate)}{e.endDate ? ` → ${formatDate(e.endDate)}` : ""}</TD>
                <TD><Badge tone={e.active ? "green" : "gray"}>{e.active ? "Active" : "Révoquée"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    {e.active && (
                      <button onClick={() => revoke(e)} aria-label="Révoquer" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"><Ban className="h-4 w-4" /></button>
                    )}
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Accorder une exonération">
        <Stack gap="md">
          <MantineSelect
            label="Élève" required searchable
            data={students.map((s) => ({ value: String(s.id), label: `${s.firstName} ${s.lastName}` }))}
            value={form.studentId ? String(form.studentId) : null}
            onChange={(v) => setForm({ ...form, studentId: v ? Number(v) : 0 })}
          />
          <MantineSelect
            label="Type" required allowDeselect={false}
            data={Object.entries(EXEMPTION_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            value={form.type}
            onChange={(v) => v && setForm({ ...form, type: v as ExemptionType })}
          />
          <NumberInput label="Pourcentage (%)" min={0} max={100} value={form.percentage ?? undefined} onChange={(v) => setForm({ ...form, percentage: typeof v === "number" ? v : null })} description="Ou renseignez un montant fixe ci-dessous" />
          <NumberInput label="Montant fixe (GNF)" min={0} value={form.amount ?? undefined} onChange={(v) => setForm({ ...form, amount: typeof v === "number" ? v : null })} thousandSeparator=" " />
          <MantineSelect
            label="Type de frais concerné" clearable placeholder="Tous les frais"
            data={Object.entries(FEE_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
            value={form.feeType}
            onChange={(v) => setForm({ ...form, feeType: (v as FeeType) ?? null })}
          />
          <Textarea label="Motif" minRows={2} autosize value={form.reason ?? ""} onChange={(e) => setForm({ ...form, reason: e.currentTarget.value })} placeholder="Raison de l'exonération…" />
          <DatePickerInput label="Début" valueFormat="DD/MM/YYYY" clearable value={form.startDate ?? null} onChange={(v) => setForm({ ...form, startDate: v })} />
          <DatePickerInput label="Fin (optionnel)" valueFormat="DD/MM/YYYY" clearable value={form.endDate ?? null} onChange={(v) => setForm({ ...form, endDate: v })} />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} disabled={saving}>{saving ? "Enregistrement…" : "Accorder"}</Button>
          </div>
        </Stack>
      </Modal>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack, Switch, TextInput } from "@mantine/core";
import { Plus, Pencil, Trash2, Calculator } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createFeeDeductionRule,
  deleteFeeDeductionRule,
  listFeeDeductionRules,
  previewFeeDeduction,
  updateFeeDeductionRule,
} from "@/lib/api/payroll";
import { listTeachers } from "@/lib/api/staff";
import type { FeeDeduction, SalaryFeeDeductionRule, SalaryFeeDeductionRuleInput } from "@/lib/types/payroll";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatGNF } from "@/lib/format";

const EMPTY: SalaryFeeDeductionRuleInput = { label: "", amountPerChild: 0, maxChildren: null, cap: null, active: true };

export function FeeDeductionPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listFeeDeductionRules, []);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SalaryFeeDeductionRule | null>(null);
  const [form, setForm] = useState<SalaryFeeDeductionRuleInput>(EMPTY);
  const [saving, setSaving] = useState(false);

  function openCreate() { setEditing(null); setForm(EMPTY); setOpen(true); }
  function openEdit(r: SalaryFeeDeductionRule) {
    setEditing(r);
    setForm({
      label: r.label,
      amountPerChild: r.amountPerChild != null ? Number(r.amountPerChild) : 0,
      maxChildren: r.maxChildren, cap: r.cap != null ? Number(r.cap) : null, active: r.active,
    });
    setOpen(true);
  }

  async function submit() {
    if (!form.label.trim()) { notifyError(new Error("Libellé requis.")); return; }
    setSaving(true);
    try {
      if (editing) await updateFeeDeductionRule(editing.id, form);
      else await createFeeDeductionRule(form);
      notifySuccess("Règle enregistrée.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(r: SalaryFeeDeductionRule) {
    confirmAction({
      title: "Supprimer la règle", message: `Supprimer « ${r.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteFeeDeductionRule(r.id); notifySuccess("Règle supprimée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm text-slate-500">Retenue sur salaire au titre des frais de scolarité des enfants du personnel</p>
          {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
        </div>
        {q.loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-slate-400">Aucune règle de déduction.</p>
        ) : (
          <Table>
            <THead>
              <TR><TH>Libellé</TH><TH>Montant / enfant</TH><TH>Enfants max</TH><TH>Plafond</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
            </THead>
            <TBody>
              {items.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium text-slate-900">{r.label}</TD>
                  <TD>{r.amountPerChild != null ? formatGNF(r.amountPerChild) : "—"}</TD>
                  <TD>{r.maxChildren ?? "—"}</TD>
                  <TD>{r.cap != null ? formatGNF(r.cap) : "—"}</TD>
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
      </div>

      <PreviewCard />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la règle" : "Nouvelle règle de déduction"}>
        <Stack gap="md">
          <TextInput label="Libellé" required value={form.label} onChange={(e) => setForm({ ...form, label: e.currentTarget.value })} placeholder="Ex. Scolarité enfants du personnel" />
          <NumberInput label="Montant par enfant (GNF)" min={0} thousandSeparator=" " value={form.amountPerChild ?? undefined} onChange={(v) => setForm({ ...form, amountPerChild: typeof v === "number" ? v : null })} />
          <NumberInput label="Nombre d'enfants max (optionnel)" min={1} value={form.maxChildren ?? undefined} onChange={(v) => setForm({ ...form, maxChildren: typeof v === "number" ? v : null })} />
          <NumberInput label="Plafond total (GNF, optionnel)" min={0} thousandSeparator=" " value={form.cap ?? undefined} onChange={(v) => setForm({ ...form, cap: typeof v === "number" ? v : null })} />
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

/** Lets the user preview the computed deduction for a given teacher. */
function PreviewCard() {
  const teachersQuery = useQuery(listTeachers, []);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const [teacherId, setTeacherId] = useState<number | null>(null);
  const [result, setResult] = useState<FeeDeduction | null>(null);
  const [loading, setLoading] = useState(false);

  async function run(id: number) {
    setLoading(true);
    try { setResult(await previewFeeDeduction(id)); }
    catch (err) { setResult(null); notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Calculator className="h-4 w-4 text-brand-600" /> Simuler une déduction
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <label className="mb-1 block text-xs text-slate-500">Enseignant / membre du personnel</label>
          <MantineSelect
            placeholder="Choisir…" searchable
            data={teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))}
            value={teacherId ? String(teacherId) : null}
            onChange={(v) => { const id = v ? Number(v) : null; setTeacherId(id); if (id) run(id); }}
          />
        </div>
        {loading ? <Spinner /> : result && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm">
            <span className="text-slate-600">{result.label ?? "Déduction"} — {result.childrenCount} enfant(s) : </span>
            <span className="font-semibold text-slate-900">{result.amount != null ? formatGNF(result.amount) : "—"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

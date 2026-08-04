"use client";

import { useMemo, useState } from "react";
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
import { Input, Label, Field } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
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
      <div className="rounded-2xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <p className="text-sm text-gray-500">Retenue sur salaire au titre des frais de scolarité des enfants du personnel</p>
          {canWrite && <Button onClick={openCreate}><Plus className="mr-1.5 h-4 w-4" /> Ajouter</Button>}
        </div>
        {q.loading ? (
          <div className="flex justify-center py-12"><Spinner /></div>
        ) : items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-gray-400">Aucune règle de déduction.</p>
        ) : (
          <Table>
            <THead>
              <TR><TH>Libellé</TH><TH>Montant / enfant</TH><TH>Enfants max</TH><TH>Plafond</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
            </THead>
            <TBody>
              {items.map((r) => (
                <TR key={r.id}>
                  <TD className="font-medium text-gray-900">{r.label}</TD>
                  <TD>{r.amountPerChild != null ? formatGNF(r.amountPerChild) : "—"}</TD>
                  <TD>{r.maxChildren ?? "—"}</TD>
                  <TD>{r.cap != null ? formatGNF(r.cap) : "—"}</TD>
                  <TD><Badge tone={r.active ? "green" : "gray"}>{r.active ? "Active" : "Inactive"}</Badge></TD>
                  {canWrite && (
                    <TD className="text-right">
                      <div className="inline-flex gap-1">
                        <button onClick={() => openEdit(r)} aria-label="Modifier" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                        <button onClick={() => remove(r)} aria-label="Supprimer" className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
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
        <div className="space-y-4">
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Ex. Scolarité enfants du personnel" />
          </Field>
          <Field>
            <Label>Montant par enfant (GNF)</Label>
            <Input type="number" min={0} value={form.amountPerChild ?? ""} onChange={(e) => setForm({ ...form, amountPerChild: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field>
            <Label>Nombre d&apos;enfants max (optionnel)</Label>
            <Input type="number" min={1} value={form.maxChildren ?? ""} onChange={(e) => setForm({ ...form, maxChildren: e.target.value === "" ? null : Number(e.target.value) })} />
          </Field>
          <Field>
            <Label>Plafond total (GNF, optionnel)</Label>
            <Input type="number" min={0} value={form.cap ?? ""} onChange={(e) => setForm({ ...form, cap: e.target.value === "" ? null : Number(e.target.value) })} />
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

/** Lets the user preview the computed deduction for a given teacher. */
function PreviewCard() {
  const teachersQuery = useQuery(listTeachers, []);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const [teacherId, setTeacherId] = useState<string>("");
  const [result, setResult] = useState<FeeDeduction | null>(null);
  const [loading, setLoading] = useState(false);

  const teacherOptions: SearchableOption[] = useMemo(
    () => teachers.map((t) => {
      const label = `${t.firstName} ${t.lastName}`;
      return { value: String(t.id), trigger: label, label, searchText: label };
    }),
    [teachers],
  );

  async function run(id: number) {
    setLoading(true);
    try { setResult(await previewFeeDeduction(id)); }
    catch (err) { setResult(null); notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
        <Calculator className="h-4 w-4 text-brand-600" /> Simuler une déduction
      </h3>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[240px]">
          <Label>Enseignant / membre du personnel</Label>
          <SearchableSelect
            value={teacherId}
            options={teacherOptions}
            onChange={(id) => { setTeacherId(id); if (id) run(Number(id)); }}
            triggerClassName="w-full justify-between px-3"
          />
        </div>
        {loading ? <Spinner /> : result && (
          <div className="rounded-xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm">
            <span className="text-gray-600">{result.label ?? "Déduction"} — {result.childrenCount} enfant(s) : </span>
            <span className="font-semibold text-gray-900">{result.amount != null ? formatGNF(result.amount) : "—"}</span>
          </div>
        )}
      </div>
    </div>
  );
}

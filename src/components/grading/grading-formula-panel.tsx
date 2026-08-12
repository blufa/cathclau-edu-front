"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Sparkles, X } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import {
  createGradingFormula,
  deleteGradingFormula,
  listGradingFormulas,
  updateGradingFormula,
} from "@/lib/api/grading";
import { listAssessmentTypes } from "@/lib/api/grading";
import {
  FORMULA_PERIOD_TYPE_LABEL,
  STEP_KIND_LABEL,
  STEP_ROLE_LABEL,
  WEIGHT_MODE_LABEL,
  type FormulaPeriodType,
  type GradingFormula,
  type GradingFormulaInput,
  type StepKind,
  type StepRole,
  type WeightMode,
} from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

/** Brouillon d'étape éditable dans le formulaire (référence les autres étapes par position dans la liste). */
interface StepInputDraft {
  key: string;
  refIndex: number | null;
  weightMode: WeightMode;
  fixedWeight: number | null;
}
interface StepDraft {
  key: string;
  label: string;
  stepKind: StepKind;
  filterMode: "ALL" | "MONTH" | "TYPE";
  monthIndex: number | null;
  assessmentTypeId: number | null;
  inputs: StepInputDraft[];
  finalStep: boolean;
  role: StepRole;
}

let keySeq = 0;
const nextKey = () => `s${++keySeq}`;

function emptyStep(): StepDraft {
  return { key: nextKey(), label: "", stepKind: "GROUP", filterMode: "ALL", monthIndex: 1, assessmentTypeId: null, inputs: [], finalStep: false, role: "NONE" };
}

function monthlyTemplate(compositionTypeId: number | null): StepDraft[] {
  const m1 = { ...emptyStep(), label: "Mois 1", filterMode: "MONTH" as const, monthIndex: 1 };
  const m2 = { ...emptyStep(), label: "Mois 2", filterMode: "MONTH" as const, monthIndex: 2 };
  const m3 = { ...emptyStep(), label: "Mois 3", filterMode: "MONTH" as const, monthIndex: 3 };
  const cours: StepDraft = {
    ...emptyStep(), label: "Moyenne de cours", stepKind: "COMBINE", role: "COURS",
    inputs: [0, 1, 2].map((i) => ({ key: nextKey(), refIndex: i, weightMode: "EQUAL" as const, fixedWeight: null })),
  };
  const compo: StepDraft = {
    ...emptyStep(), label: "Composition", filterMode: "TYPE", assessmentTypeId: compositionTypeId, role: "COMPOSITION",
  };
  const semestre: StepDraft = {
    ...emptyStep(), label: "Moyenne semestrielle", stepKind: "COMBINE", finalStep: true,
    inputs: [
      { key: nextKey(), refIndex: 3, weightMode: "EQUAL", fixedWeight: null },
      { key: nextKey(), refIndex: 4, weightMode: "FIXED", fixedWeight: 2 },
    ],
  };
  return [m1, m2, m3, cours, compo, semestre];
}

function draftToStep(d: StepDraft, order: number): GradingFormulaInput["steps"][number] {
  return {
    stepOrder: order,
    label: d.label || null,
    stepKind: d.stepKind,
    monthIndex: d.stepKind === "GROUP" && d.filterMode === "MONTH" ? d.monthIndex : null,
    assessmentTypeId: d.stepKind === "GROUP" && d.filterMode === "TYPE" ? d.assessmentTypeId : null,
    inputs: d.stepKind === "COMBINE"
      ? d.inputs.filter((i) => i.refIndex != null).map((i) => ({
          refStepOrder: (i.refIndex as number) + 1, weightMode: i.weightMode,
          fixedWeight: i.weightMode === "FIXED" ? i.fixedWeight ?? 1 : null,
        }))
      : [],
    finalStep: d.finalStep,
    role: d.role,
  };
}

function stepsToDrafts(f: GradingFormula): StepDraft[] {
  const byOrder = [...f.steps].sort((a, b) => a.stepOrder - b.stepOrder);
  return byOrder.map((s) => ({
    key: nextKey(),
    label: s.label ?? "",
    stepKind: s.stepKind,
    filterMode: s.monthIndex != null ? "MONTH" : s.assessmentTypeId != null ? "TYPE" : "ALL",
    monthIndex: s.monthIndex ?? 1,
    assessmentTypeId: s.assessmentTypeId ?? null,
    inputs: s.inputs.map((i) => ({
      key: nextKey(), refIndex: i.refStepOrder - 1, weightMode: i.weightMode, fixedWeight: i.fixedWeight ?? null,
    })),
    finalStep: s.finalStep,
    role: s.role ?? "NONE",
  }));
}

export function GradingFormulaPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listGradingFormulas, []);
  const typesQuery = useQuery(listAssessmentTypes, []);
  const assessmentTypes = useMemo(() => typesQuery.data ?? [], [typesQuery.data]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<GradingFormula | null>(null);
  const [label, setLabel] = useState("");
  const [periodType, setPeriodType] = useState<FormulaPeriodType>("SEMESTRE");
  const [active, setActive] = useState(true);
  const [steps, setSteps] = useState<StepDraft[]>([emptyStep()]);
  const [saving, setSaving] = useState(false);

  function openCreate() {
    setEditing(null); setLabel(""); setPeriodType("SEMESTRE"); setActive(true); setSteps([emptyStep()]); setOpen(true);
  }
  function openEdit(f: GradingFormula) {
    setEditing(f); setLabel(f.label); setPeriodType(f.periodType); setActive(f.active); setSteps(stepsToDrafts(f)); setOpen(true);
  }
  function applyTemplate() {
    const compo = assessmentTypes.find((t) => /compo/i.test(t.code) || /compo/i.test(t.label));
    setSteps(monthlyTemplate(compo ? compo.id : null));
  }

  function updateStep(index: number, patch: Partial<StepDraft>) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function setFinal(index: number) {
    setSteps((prev) => prev.map((s, i) => ({ ...s, finalStep: i === index })));
  }
  function addStep() {
    setSteps((prev) => [...prev, emptyStep()]);
  }
  function removeStep(index: number) {
    setSteps((prev) => prev
      .filter((_, i) => i !== index)
      .map((s) => ({ ...s, inputs: s.inputs.filter((inp) => inp.refIndex !== index).map((inp) => ({
        ...inp, refIndex: inp.refIndex != null && inp.refIndex > index ? inp.refIndex - 1 : inp.refIndex,
      })) })));
  }
  function addInput(stepIndex: number) {
    setSteps((prev) => prev.map((s, i) => i === stepIndex
      ? { ...s, inputs: [...s.inputs, { key: nextKey(), refIndex: stepIndex > 0 ? 0 : null, weightMode: "EQUAL", fixedWeight: null }] }
      : s));
  }
  function updateInput(stepIndex: number, inputIndex: number, patch: Partial<StepInputDraft>) {
    setSteps((prev) => prev.map((s, i) => i === stepIndex
      ? { ...s, inputs: s.inputs.map((inp, j) => (j === inputIndex ? { ...inp, ...patch } : inp)) }
      : s));
  }
  function removeInput(stepIndex: number, inputIndex: number) {
    setSteps((prev) => prev.map((s, i) => i === stepIndex ? { ...s, inputs: s.inputs.filter((_, j) => j !== inputIndex) } : s));
  }

  async function submit() {
    if (!label.trim()) { notifyError(new Error("Le nom de la formule est requis.")); return; }
    if (steps.length === 0) { notifyError(new Error("La formule doit comporter au moins une étape.")); return; }
    if (steps.filter((s) => s.finalStep).length !== 1) {
      notifyError(new Error("Choisissez exactement une étape finale (le résultat de la formule).")); return;
    }
    if (steps.some((s) => s.stepKind === "COMBINE" && s.inputs.length === 0)) {
      notifyError(new Error("Une étape de combinaison doit référencer au moins une étape précédente.")); return;
    }
    if (steps.filter((s) => s.role === "COURS").length > 1 || steps.filter((s) => s.role === "COMPOSITION").length > 1) {
      notifyError(new Error("Une seule étape peut être étiquetée « Cours », et une seule « Composition ».")); return;
    }
    const payload: GradingFormulaInput = {
      label, periodType, active,
      steps: steps.map((s, i) => draftToStep(s, i + 1)),
    };
    setSaving(true);
    try {
      if (editing) await updateGradingFormula(editing.id, payload);
      else await createGradingFormula(payload);
      notifySuccess("Formule de calcul enregistrée.");
      setOpen(false);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  function remove(f: GradingFormula) {
    confirmAction({
      title: "Supprimer la formule", message: `Supprimer « ${f.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteGradingFormula(f.id); notifySuccess("Formule supprimée."); q.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const items = q.data ?? [];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <p className="text-sm text-gray-500">Comment la moyenne d&apos;une matière est calculée, étape par étape (mois, composition…)</p>
        {canWrite && <Button onClick={openCreate} leftSection={<Plus className="h-4 w-4" />}>Ajouter</Button>}
      </div>
      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : items.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-gray-400">
          Aucune formule configurée — la moyenne pondérée classique s&apos;applique par défaut.
        </p>
      ) : (
        <Table>
          <THead>
            <TR><TH>Nom</TH><TH>Période</TH><TH>Étapes</TH><TH>Statut</TH>{canWrite && <TH className="text-right">Actions</TH>}</TR>
          </THead>
          <TBody>
            {items.map((f) => (
              <TR key={f.id}>
                <TD className="font-medium text-gray-900">{f.label}</TD>
                <TD className="text-sm text-gray-600">{FORMULA_PERIOD_TYPE_LABEL[f.periodType] ?? f.periodType}</TD>
                <TD className="text-sm text-gray-600">{f.steps.length}</TD>
                <TD><Badge tone={f.active ? "green" : "gray"}>{f.active ? "Active" : "Inactive"}</Badge></TD>
                {canWrite && (
                  <TD className="text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => openEdit(f)} aria-label="Modifier" className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-700"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => remove(f)} aria-label="Supprimer" className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </TD>
                )}
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Modifier la formule" : "Nouvelle formule de calcul"} className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <Label>Nom <span className="text-error-500">*</span></Label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex. Semestre standard" />
            </Field>
            <Field>
              <Label>Période concernée</Label>
              <Select value={periodType} onChange={(e) => setPeriodType(e.target.value as FormulaPeriodType)}>
                {Object.entries(FORMULA_PERIOD_TYPE_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </Select>
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2">
            <div className="flex items-center gap-3">
              <Switch checked={active} onChange={setActive} ariaLabel="Active" />
              <span className="text-sm text-gray-700">Active pour ce type de période</span>
            </div>
            {!editing && (
              <Button variant="secondary" onClick={applyTemplate} leftSection={<Sparkles className="h-4 w-4" />}>
                Modèle mensuel + composition
              </Button>
            )}
          </div>

          <div className="space-y-3">
            {steps.map((s, i) => (
              <div key={s.key} className="rounded-xl border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Étape {i + 1}</span>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(i)} aria-label="Supprimer l'étape" className="rounded-lg p-1 text-gray-400 hover:bg-error-50 hover:text-error-600">
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field>
                    <Label>Libellé</Label>
                    <Input value={s.label} onChange={(e) => updateStep(i, { label: e.target.value })} placeholder="Ex. Mois 1, Composition…" />
                  </Field>
                  <Field>
                    <Label>Type d&apos;étape</Label>
                    <Select value={s.stepKind} onChange={(e) => updateStep(i, { stepKind: e.target.value as StepKind })}>
                      {Object.entries(STEP_KIND_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                    </Select>
                  </Field>
                </div>

                {s.stepKind === "GROUP" ? (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <Field>
                      <Label>Filtrer par</Label>
                      <Select value={s.filterMode} onChange={(e) => updateStep(i, { filterMode: e.target.value as StepDraft["filterMode"] })}>
                        <option value="ALL">Toute la période</option>
                        <option value="MONTH">Mois n°</option>
                        <option value="TYPE">Type d&apos;évaluation</option>
                      </Select>
                    </Field>
                    {s.filterMode === "MONTH" && (
                      <Field>
                        <Label>N° du mois</Label>
                        <Input type="number" min={1} value={s.monthIndex ?? 1} onChange={(e) => updateStep(i, { monthIndex: Number(e.target.value) || 1 })} />
                      </Field>
                    )}
                    {s.filterMode === "TYPE" && (
                      <Field>
                        <Label>Type d&apos;évaluation</Label>
                        <Select value={s.assessmentTypeId ?? ""} onChange={(e) => updateStep(i, { assessmentTypeId: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">— Choisir —</option>
                          {assessmentTypes.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
                        </Select>
                      </Field>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 space-y-2">
                    <Label>Entrées combinées (étapes précédentes)</Label>
                    {s.inputs.length === 0 && <p className="text-xs text-gray-400">Aucune entrée — ajoutez une étape précédente à combiner.</p>}
                    {s.inputs.map((inp, j) => (
                      <div key={inp.key} className="flex items-center gap-2">
                        <Select className="flex-1" value={inp.refIndex ?? ""} onChange={(e) => updateInput(i, j, { refIndex: e.target.value ? Number(e.target.value) : null })}>
                          <option value="">— Étape —</option>
                          {steps.slice(0, i).map((prev, idx) => (<option key={idx} value={idx}>Étape {idx + 1}{prev.label ? ` (${prev.label})` : ""}</option>))}
                        </Select>
                        <Select className="flex-1" value={inp.weightMode} onChange={(e) => updateInput(i, j, { weightMode: e.target.value as WeightMode })}>
                          {Object.entries(WEIGHT_MODE_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                        </Select>
                        {inp.weightMode === "FIXED" && (
                          <Input className="w-24" type="number" step={0.5} value={inp.fixedWeight ?? 1} onChange={(e) => updateInput(i, j, { fixedWeight: Number(e.target.value) || 1 })} />
                        )}
                        <button onClick={() => removeInput(i, j)} aria-label="Retirer l'entrée" className="rounded-lg p-1.5 text-gray-400 hover:bg-error-50 hover:text-error-600"><X className="h-4 w-4" /></button>
                      </div>
                    ))}
                    <Button variant="secondary" onClick={() => addInput(i)} leftSection={<Plus className="h-4 w-4" />}>Ajouter une entrée</Button>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-2 gap-3 items-end">
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="radio" name="finalStep" checked={s.finalStep} onChange={() => setFinal(i)} className="h-4 w-4 accent-brand-600" />
                    Étape finale (résultat de la formule)
                  </label>
                  <Field>
                    <Label>Alimente le bulletin</Label>
                    <Select value={s.role} onChange={(e) => updateStep(i, { role: e.target.value as StepRole })}>
                      {Object.entries(STEP_ROLE_LABEL).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
                    </Select>
                  </Field>
                </div>
              </div>
            ))}
            <Button variant="secondary" onClick={addStep} leftSection={<Plus className="h-4 w-4" />}>Ajouter une étape</Button>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
            <Button variant="secondary" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={submit} loading={saving}>Enregistrer</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getGradingScale, updateGradingScale } from "@/lib/api/grading";
import { CYCLE_GROUP_LABEL, type CycleGroup, type GradingScaleInput } from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/feedback";

const CYCLE_GROUPS: CycleGroup[] = ["PRIMAIRE", "SECONDAIRE"];

const FIELDS: { key: keyof GradingScaleInput; label: string; hint?: string }[] = [
  { key: "passThreshold", label: "Seuil d'admission", hint: "Moyenne minimale pour être admis" },
  { key: "passableMin", label: "Passable (min)" },
  { key: "assezBienMin", label: "Assez Bien (min)" },
  { key: "bienMin", label: "Bien (min)" },
  { key: "tresBienMin", label: "Très Bien (min)" },
  { key: "complimentsMin", label: "Compliments (min)" },
  { key: "felicitationsMin", label: "Félicitations (min)" },
  { key: "distinctionNoFailingThreshold", label: "Aucune note < seuil pour distinction" },
];

export function GradingScalePanel({ canWrite }: { canWrite: boolean }) {
  const [cycleGroup, setCycleGroup] = useState<CycleGroup>("PRIMAIRE");
  const [form, setForm] = useState<GradingScaleInput | null>(null);
  // Dérivé plutôt qu'un setState synchrone en tête d'effet (voir règle ESLint
  // react-hooks/set-state-in-effect) : le chargement est en cours tant que la dernière réponse reçue
  // ne correspond pas au cycle actuellement sélectionné.
  const [loadedFor, setLoadedFor] = useState<CycleGroup | null>(null);
  const loading = loadedFor !== cycleGroup;
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    getGradingScale(cycleGroup)
      .then((d) => {
        if (!active) return;
        setForm({
          passThreshold: Number(d.passThreshold),
          passableMin: Number(d.passableMin),
          assezBienMin: Number(d.assezBienMin),
          bienMin: Number(d.bienMin),
          tresBienMin: Number(d.tresBienMin),
          felicitationsMin: Number(d.felicitationsMin),
          complimentsMin: Number(d.complimentsMin),
          distinctionNoFailingThreshold: Number(d.distinctionNoFailingThreshold),
        });
      })
      .catch((err) => { if (active) notifyError(err); })
      .finally(() => { if (active) setLoadedFor(cycleGroup); });
    return () => { active = false; };
  }, [cycleGroup]);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await updateGradingScale(cycleGroup, form);
      notifySuccess("Barème enregistré.");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl rounded-2xl border border-gray-200 bg-white p-6">
      <p className="mb-3 text-xs text-gray-400">
        Seuils (sur 20) déterminant les mentions et la décision d&apos;admission portées sur les
        bulletins — un barème distinct pour le primaire et le secondaire.
      </p>
      <div className="mb-4 inline-flex rounded-xl border border-gray-200 p-1">
        {CYCLE_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => setCycleGroup(g)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              cycleGroup === g ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {CYCLE_GROUP_LABEL[g]}
          </button>
        ))}
      </div>
      {loading || !form ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <Field key={f.key}>
                <Label>{f.label}</Label>
                {f.hint && <p className="text-xs text-gray-400">{f.hint}</p>}
                <Input
                  type="number" min={0} max={20} step={0.5} disabled={!canWrite}
                  value={form[f.key]}
                  onChange={(e) => setForm((s) => (s ? { ...s, [f.key]: Number(e.target.value) || 0 } : s))}
                />
              </Field>
            ))}
          </div>
          {canWrite && (
            <div className="mt-4 flex justify-end">
              <Button onClick={save} loading={saving}>Enregistrer</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { getCalculationSettings, updateCalculationSettings } from "@/lib/api/grading";
import {
  AVERAGE_METHOD_LABEL,
  ROUNDING_POLICY_LABEL,
  type AverageMethod,
  type GradingCalculationSettingsInput,
  type RoundingPolicy,
} from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notifyError, notifySuccess } from "@/lib/feedback";

export function CalculationSettingsPanel({ canWrite }: { canWrite: boolean }) {
  const [form, setForm] = useState<GradingCalculationSettingsInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCalculationSettings()
      .then((d) => setForm({ averageMethod: d.averageMethod, decimals: d.decimals, rounding: d.rounding }))
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await updateCalculationSettings(form);
      notifySuccess("Réglage du moteur de calcul enregistré.");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="max-w-xl rounded-2xl border border-gray-200 bg-white p-6">
      <p className="mb-4 text-xs text-gray-400">
        Méthode de calcul des moyennes, précision et politique d&apos;arrondi appliquées aux bulletins.
      </p>
      <div className="space-y-4">
        <Field>
          <Label>Méthode de calcul</Label>
          <Select disabled={!canWrite} value={form.averageMethod}
            onChange={(e) => setForm((s) => (s ? { ...s, averageMethod: e.target.value as AverageMethod } : s))}>
            {Object.entries(AVERAGE_METHOD_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Nombre de décimales</Label>
          <Input type="number" min={0} max={4} disabled={!canWrite} value={form.decimals}
            onChange={(e) => setForm((s) => (s ? { ...s, decimals: Number(e.target.value) || 0 } : s))} />
        </Field>
        <Field>
          <Label>Arrondi</Label>
          <Select disabled={!canWrite} value={form.rounding}
            onChange={(e) => setForm((s) => (s ? { ...s, rounding: e.target.value as RoundingPolicy } : s))}>
            {Object.entries(ROUNDING_POLICY_LABEL).map(([value, label]) => (<option key={value} value={value}>{label}</option>))}
          </Select>
        </Field>
        {canWrite && (
          <div className="flex justify-end">
            <Button onClick={save} loading={saving}>Enregistrer</Button>
          </div>
        )}
      </div>
    </div>
  );
}

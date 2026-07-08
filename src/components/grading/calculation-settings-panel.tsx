"use client";

import { useEffect, useState } from "react";
import { NumberInput, Select as MantineSelect, Stack } from "@mantine/core";
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
    <div className="max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
      <p className="mb-4 text-xs text-slate-400">
        Méthode de calcul des moyennes, précision et politique d&apos;arrondi appliquées aux bulletins.
      </p>
      <Stack gap="md">
        <MantineSelect
          label="Méthode de calcul"
          disabled={!canWrite}
          data={Object.entries(AVERAGE_METHOD_LABEL).map(([value, label]) => ({ value, label }))}
          value={form.averageMethod}
          onChange={(v) => v && setForm((s) => (s ? { ...s, averageMethod: v as AverageMethod } : s))}
          allowDeselect={false}
        />
        <NumberInput
          label="Nombre de décimales"
          min={0}
          max={4}
          disabled={!canWrite}
          value={form.decimals}
          onChange={(v) => setForm((s) => (s ? { ...s, decimals: typeof v === "number" ? v : 2 } : s))}
        />
        <MantineSelect
          label="Arrondi"
          disabled={!canWrite}
          data={Object.entries(ROUNDING_POLICY_LABEL).map(([value, label]) => ({ value, label }))}
          value={form.rounding}
          onChange={(v) => v && setForm((s) => (s ? { ...s, rounding: v as RoundingPolicy } : s))}
          allowDeselect={false}
        />
        {canWrite && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        )}
      </Stack>
    </div>
  );
}

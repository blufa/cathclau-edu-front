"use client";

import { useEffect, useState } from "react";
import { NumberInput, SimpleGrid, Stack } from "@mantine/core";
import { getGradingScale, updateGradingScale } from "@/lib/api/grading";
import type { GradingScaleInput } from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

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
  const [form, setForm] = useState<GradingScaleInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getGradingScale()
      .then((d) =>
        setForm({
          passThreshold: Number(d.passThreshold),
          passableMin: Number(d.passableMin),
          assezBienMin: Number(d.assezBienMin),
          bienMin: Number(d.bienMin),
          tresBienMin: Number(d.tresBienMin),
          felicitationsMin: Number(d.felicitationsMin),
          complimentsMin: Number(d.complimentsMin),
          distinctionNoFailingThreshold: Number(d.distinctionNoFailingThreshold),
        }),
      )
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await updateGradingScale(form);
      notifySuccess("Barème enregistré.");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6">
      <p className="mb-4 text-xs text-slate-400">
        Seuils (sur 20) déterminant les mentions et la décision d&apos;admission portées sur les bulletins.
      </p>
      <Stack gap="md">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {FIELDS.map((f) => (
            <NumberInput
              key={f.key}
              label={f.label}
              description={f.hint}
              min={0}
              max={20}
              step={0.5}
              decimalScale={2}
              disabled={!canWrite}
              value={form[f.key]}
              onChange={(v) => setForm((s) => (s ? { ...s, [f.key]: typeof v === "number" ? v : 0 } : s))}
            />
          ))}
        </SimpleGrid>
        {canWrite && (
          <div className="flex justify-end">
            <Button onClick={save} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</Button>
          </div>
        )}
      </Stack>
    </div>
  );
}

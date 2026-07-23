"use client";

import { useEffect, useState } from "react";
import { getAssessmentSessionSettings, updateAssessmentSessionSettings } from "@/lib/api/grading";
import type { AssessmentSessionSettingsInput } from "@/lib/types/grading";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/feedback";

const FIELDS: { key: keyof AssessmentSessionSettingsInput; label: string }[] = [
  { key: "quizMinutes", label: "Interrogation (min)" },
  { key: "homeworkMinutes", label: "Devoir (min)" },
  { key: "examMinutes", label: "Composition (min)" },
  { key: "finalMinutes", label: "Examen (min)" },
];

export function SessionSettingsPanel({ canWrite }: { canWrite: boolean }) {
  const [form, setForm] = useState<AssessmentSessionSettingsInput | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAssessmentSessionSettings()
      .then((d) =>
        setForm({
          quizMinutes: d.quizMinutes ?? 0,
          homeworkMinutes: d.homeworkMinutes ?? 0,
          examMinutes: d.examMinutes ?? 0,
          finalMinutes: d.finalMinutes ?? 0,
        }),
      )
      .catch(notifyError)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!form) return;
    setSaving(true);
    try {
      await updateAssessmentSessionSettings(form);
      notifySuccess("Durées de séance enregistrées.");
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) return <div className="flex justify-center py-12"><Spinner /></div>;

  return (
    <div className="max-w-2xl rounded-2xl border border-gray-200 bg-white p-6">
      <p className="mb-4 text-xs text-gray-400">
        Durée d&apos;une séance par type d&apos;évaluation — utilisée pour calculer les heures travaillées des enseignants.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <Field key={f.key}>
            <Label>{f.label}</Label>
            <Input type="number" min={0} step={5} disabled={!canWrite} value={form[f.key]}
              onChange={(e) => setForm((s) => (s ? { ...s, [f.key]: Number(e.target.value) || 0 } : s))} />
          </Field>
        ))}
      </div>
      {canWrite && (
        <div className="mt-4 flex justify-end">
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      )}
    </div>
  );
}

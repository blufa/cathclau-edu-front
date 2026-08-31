"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { listLevels } from "@/lib/api/academics";
import { getAssignedLevels, setAssignedLevels } from "@/lib/api/staff";
import type { Niveau } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Label } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Affecte les niveaux (cycles) où un enseignant est habilité à enseigner (checklist sur sa fiche). */
export function TeacherLevelsSection({ teacherId, canWrite }: { teacherId: number; canWrite: boolean }) {
  const levelsQuery = useQuery(listLevels, []);
  const assignedQuery = useQuery(() => getAssignedLevels(teacherId), [teacherId]);

  if (levelsQuery.loading || assignedQuery.loading || !assignedQuery.data) {
    return <div className="flex justify-center py-6"><Spinner /></div>;
  }

  return (
    <LevelPicker
      key={assignedQuery.data.join(",")}
      teacherId={teacherId}
      canWrite={canWrite}
      levels={levelsQuery.data ?? []}
      initialSelected={assignedQuery.data.map(String)}
      onSaved={() => assignedQuery.refetch()}
    />
  );
}

function LevelPicker({
  teacherId, canWrite, levels, initialSelected, onSaved,
}: {
  teacherId: number;
  canWrite: boolean;
  levels: Niveau[];
  initialSelected: string[];
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saving, setSaving] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  async function save() {
    setSaving(true);
    try {
      await setAssignedLevels(teacherId, selected.map(Number));
      notifySuccess("Niveaux enseignés enregistrés");
      onSaved();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <Field>
        <Label>Niveaux enseignés</Label>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {levels.length === 0 && <p className="px-1 py-2 text-sm text-gray-400">Aucun niveau — créez-les d&apos;abord (Référentiels → Niveaux).</p>}
          {levels.map((l) => (
            <label key={l.id} className={`flex items-center gap-2 text-sm ${canWrite ? "cursor-pointer" : "opacity-60"}`}>
              <input type="checkbox" disabled={!canWrite} checked={selected.includes(String(l.id))}
                onChange={() => toggle(String(l.id))}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
              {l.label}
            </label>
          ))}
        </div>
      </Field>
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { listSubjects } from "@/lib/api/academics";
import { getAssignedSubjects, setAssignedSubjects } from "@/lib/api/staff";
import type { Matiere } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Label } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Affecte les matières enseignées par un enseignant (checklist multi-sélection sur sa fiche). */
export function TeacherSubjectsSection({ teacherId, canWrite }: { teacherId: number; canWrite: boolean }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const assignedQuery = useQuery(() => getAssignedSubjects(teacherId), [teacherId]);

  if (subjectsQuery.loading || assignedQuery.loading || !assignedQuery.data) {
    return <div className="flex justify-center py-6"><Spinner /></div>;
  }

  return (
    <SubjectPicker
      key={assignedQuery.data.join(",")}
      teacherId={teacherId}
      canWrite={canWrite}
      subjects={subjectsQuery.data ?? []}
      initialSelected={assignedQuery.data.map(String)}
      onSaved={() => assignedQuery.refetch()}
    />
  );
}

function SubjectPicker({
  teacherId, canWrite, subjects, initialSelected, onSaved,
}: {
  teacherId: number;
  canWrite: boolean;
  subjects: Matiere[];
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
      await setAssignedSubjects(teacherId, selected.map(Number));
      notifySuccess("Matières enseignées enregistrées");
      onSaved();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <Field>
        <Label>Matières enseignées</Label>
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {subjects.length === 0 && <p className="px-1 py-2 text-sm text-gray-400">Aucune matière.</p>}
          {subjects.map((s) => (
            <label key={s.id} className={`flex items-center gap-2 text-sm ${canWrite ? "cursor-pointer" : "opacity-60"}`}>
              <input type="checkbox" disabled={!canWrite} checked={selected.includes(String(s.id))}
                onChange={() => toggle(String(s.id))}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
              {s.label}
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

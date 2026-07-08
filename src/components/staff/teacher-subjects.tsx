"use client";

import { useMemo, useState } from "react";
import { MultiSelect } from "@mantine/core";
import { useQuery } from "@/hooks/use-query";
import { listSubjects } from "@/lib/api/academics";
import { getAssignedSubjects, setAssignedSubjects } from "@/lib/api/staff";
import type { Matiere } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Affecte les matières enseignées par un enseignant (liste déroulante multi-sélection sur sa fiche). */
export function TeacherSubjectsSection({ teacherId, canWrite }: { teacherId: number; canWrite: boolean }) {
  const subjectsQuery = useQuery(listSubjects, []);
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
  const options = useMemo(() => subjects.map((s) => ({ value: String(s.id), label: s.label })), [subjects]);

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
      <MultiSelect
        label="Matières enseignées"
        placeholder="Sélectionner les matières"
        searchable
        data={options}
        value={selected}
        onChange={setSelected}
        readOnly={!canWrite}
      />
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      )}
    </div>
  );
}

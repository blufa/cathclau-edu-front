"use client";

import { useMemo, useState } from "react";
import { MultiSelect, Select } from "@mantine/core";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { getAssignedClasses, setAssignedClasses } from "@/lib/api/staff";
import type { AnneeScolaire, Classe, Niveau } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Affecte les classes enseignées par un enseignant (il peut en enseigner plusieurs).
 * Un filtre par niveau aide à retrouver les classes ; la checklist conserve la sélection multi-niveaux.
 */
export function TeacherClassesSection({ teacherId, canWrite }: { teacherId: number; canWrite: boolean }) {
  const yearsQuery = useQuery(listAcademicYears, []);
  const levelsQuery = useQuery(listLevels, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYear = years.find((y) => y.current) ?? years[0];
  const classesQuery = useQuery(
    () => (currentYear ? listClasses(currentYear.id) : Promise.resolve([])),
    [currentYear?.id],
  );
  const assignedQuery = useQuery(() => getAssignedClasses(teacherId), [teacherId]);

  if (classesQuery.loading || assignedQuery.loading || !assignedQuery.data) {
    return <div className="flex justify-center py-6"><Spinner /></div>;
  }

  return (
    <ClassPicker
      key={assignedQuery.data.join(",")}
      teacherId={teacherId}
      canWrite={canWrite}
      classes={classesQuery.data ?? []}
      levels={levelsQuery.data ?? []}
      currentYear={currentYear}
      initialSelected={assignedQuery.data.map(String)}
      onSaved={() => assignedQuery.refetch()}
    />
  );
}

function ClassPicker({
  teacherId, canWrite, classes, levels, currentYear, initialSelected, onSaved,
}: {
  teacherId: number;
  canWrite: boolean;
  classes: Classe[];
  levels: Niveau[];
  currentYear?: AnneeScolaire;
  initialSelected: string[];
  onSaved: () => void;
}) {
  const [levelFilter, setLevelFilter] = useState("");
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [saving, setSaving] = useState(false);

  const levelOrder = useMemo(() => new Map(levels.map((l) => [l.id, l.sortOrder])), [levels]);
  const options = useMemo(
    () =>
      [...classes]
        .filter((c) => !levelFilter || String(c.levelId) === levelFilter)
        .sort((a, b) => (levelOrder.get(a.levelId ?? -1) ?? 0) - (levelOrder.get(b.levelId ?? -1) ?? 0)
          || (a.label ?? "").localeCompare(b.label ?? "", "fr", { numeric: true }))
        .map((c) => ({ value: String(c.id), label: c.label })),
    [classes, levelFilter, levelOrder],
  );

  async function save() {
    setSaving(true);
    try {
      await setAssignedClasses(teacherId, selected.map(Number));
      notifySuccess("Classes enseignées enregistrées");
      onSaved();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <Select
        label="Filtrer par niveau"
        className="sm:w-56"
        data={[{ value: "", label: "Tous les niveaux" }, ...levels.map((l) => ({ value: String(l.id), label: l.label }))]}
        value={levelFilter}
        onChange={(value) => setLevelFilter(value ?? "")}
      />
      <MultiSelect
        label="Classes enseignées"
        placeholder="Sélectionner les classes"
        searchable
        data={options}
        value={selected}
        onChange={setSelected}
        readOnly={!canWrite}
        description={currentYear ? `Année ${currentYear.label}` : undefined}
      />
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      )}
    </div>
  );
}

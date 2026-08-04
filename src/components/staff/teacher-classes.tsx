"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { getAssignedClasses, setAssignedClasses } from "@/lib/api/staff";
import type { AnneeScolaire, Classe, Niveau } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
          || (a.label ?? "").localeCompare(b.label ?? "", "fr", { numeric: true })),
    [classes, levelFilter, levelOrder],
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

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
      <Field>
        <Label>Filtrer par niveau</Label>
        <Select className="sm:w-56" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">Tous les niveaux</option>
          {levels.map((l) => (<option key={l.id} value={l.id}>{l.label}</option>))}
        </Select>
      </Field>
      <Field>
        <Label>Classes enseignées</Label>
        {currentYear && <p className="text-xs text-gray-400">Année {currentYear.label}</p>}
        <div className="max-h-52 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
          {options.length === 0 && <p className="px-1 py-2 text-sm text-gray-400">Aucune classe.</p>}
          {options.map((c) => (
            <label key={c.id} className={`flex items-center gap-2 text-sm ${canWrite ? "cursor-pointer" : "opacity-60"}`}>
              <input type="checkbox" disabled={!canWrite} checked={selected.includes(String(c.id))}
                onChange={() => toggle(String(c.id))}
                className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
              {c.label}
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

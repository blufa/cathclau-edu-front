"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { assignClassSubject, listAcademicYears, listClasses, listLevels, listSubjects } from "@/lib/api/academics";
import { getAssignedClasses, getAssignedSubjects, setAssignedClasses } from "@/lib/api/staff";
import type { AnneeScolaire, Classe, Niveau } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Affecte les classes enseignées par un enseignant (il peut en enseigner plusieurs).
 * Un filtre par niveau aide à retrouver les classes ; la checklist conserve la sélection multi-niveaux.
 */
export function TeacherClassesSection({ teacherId, canWrite }: { teacherId: number; canWrite: boolean }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const levelsQuery = useCachedQuery(tenantId ? `levels:${tenantId}` : null, listLevels, [tenantId]);
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
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const [levelFilter, setLevelFilter] = useState("");
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [subjectId, setSubjectId] = useState("");
  const [saving, setSaving] = useState(false);

  // Matières déjà déclarées par l'enseignant (fiche « Matières enseignées ») — servent à affecter
  // automatiquement la matière sur chaque nouvelle classe cochée, sans repasser par un second écran.
  const assignedSubjectsQuery = useQuery(() => getAssignedSubjects(teacherId), [teacherId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);
  const teacherSubjects = useMemo(
    () => (subjectsQuery.data ?? []).filter((s) => (assignedSubjectsQuery.data ?? []).includes(s.id)),
    [subjectsQuery.data, assignedSubjectsQuery.data],
  );
  // Repli sur le catalogue complet si l'enseignant n'a encore déclaré aucune matière.
  const subjectOptions = teacherSubjects.length > 0 ? teacherSubjects : (subjectsQuery.data ?? []);

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
      // Affecte directement la matière choisie sur chaque classe nouvellement cochée — l'enseignant
      // apparaît alors tout de suite dans l'emploi du temps/la saisie de notes de cette classe pour
      // cette matière, sans passer par un second écran (Classe → Matières).
      const newlyAdded = selected.filter((id) => !initialSelected.includes(id));
      if (subjectId && newlyAdded.length > 0) {
        await Promise.all(newlyAdded.map((id) => assignClassSubject(Number(id), Number(subjectId), teacherId)));
      }
      notifySuccess("Classes enseignées enregistrées");
      onSaved();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }

  return (
    <div className="space-y-3">
      <Field>
        <Label>Filtrer par niveau</Label>
        <SearchableSelect
          triggerClassName="sm:w-56 justify-between px-3"
          value={levelFilter}
          onChange={setLevelFilter}
          options={[
            { value: "", trigger: "Tous les niveaux", label: "Tous les niveaux", searchText: "" },
            ...levels.map((l): SearchableOption => ({ value: String(l.id), trigger: l.label, label: l.label, searchText: l.label })),
          ]}
        />
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
      {canWrite && subjectOptions.length > 0 && (
        <Field>
          <Label>Matière enseignée dans les nouvelles classes cochées</Label>
          <SearchableSelect
            value={subjectId}
            onChange={setSubjectId}
            triggerClassName="w-full justify-between px-3"
            options={[
              { value: "", trigger: "— Ne pas affecter de matière automatiquement —", label: "— Ne pas affecter de matière automatiquement —", searchText: "" },
              ...subjectOptions.map((s): SearchableOption => ({ value: String(s.id), trigger: s.label, label: s.label, searchText: s.label })),
            ]}
          />
          <p className="mt-1 text-xs text-gray-400">
            S&apos;applique uniquement aux classes que vous venez de cocher (pas celles déjà enregistrées).
          </p>
        </Field>
      )}
      {canWrite && (
        <div className="flex justify-end">
          <Button onClick={save} loading={saving}>Enregistrer</Button>
        </div>
      )}
    </div>
  );
}

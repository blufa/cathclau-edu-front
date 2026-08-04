"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { assignClassSubject, listAcademicYears, listClassSubjects, listClasses, listLevels, listSubjects } from "@/lib/api/academics";
import { getAssignedClasses, getAssignedSubjects, setAssignedClasses, setAssignedSubjects } from "@/lib/api/staff";
import type { ClasseMatiere } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Field, Label } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

interface Row { key: string; classId: string; subjectId: string }
let seq = 0;
const emptyRow = (): Row => ({ key: `r${++seq}`, classId: "", subjectId: "" });

/**
 * Affecte directement l'enseignant à des classes + matières (crée le lien réel classe↔matière↔
 * enseignant, celui que lit l'emploi du temps) — pas besoin de repasser par la fiche de la classe
 * pour qu'il apparaisse dans le menu déroulant de la grille. On choisit d'abord les niveaux où il
 * évolue (ex. de la 7ème à la 10ème) : les classes proposées se limitent à ces niveaux, et pour
 * chaque classe choisie, seules les matières déjà affectées à cette classe (par le Directeur des
 * Études) sont proposées — le coefficient existant est conservé, pas ressaisi ici.
 */
export function TeacherClassSubjectsAssignment({ teacherId }: { teacherId: number }) {
  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const currentYear = years.find((y) => y.current) ?? years[0];
  const classesQuery = useQuery(() => (currentYear ? listClasses(currentYear.id) : Promise.resolve([])), [currentYear?.id]);
  const levelsQuery = useQuery(listLevels, []);
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const levels = useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);

  const [selectedLevels, setSelectedLevels] = useState<Set<number>>(new Set());
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<number | null>(null);

  const levelOrder = useMemo(() => new Map(levels.map((l) => [l.id, l.sortOrder])), [levels]);
  const filteredClasses = useMemo(
    () => classes
      .filter((c) => selectedLevels.size === 0 || (c.levelId != null && selectedLevels.has(c.levelId)))
      .sort((a, b) => (levelOrder.get(a.levelId ?? -1) ?? 0) - (levelOrder.get(b.levelId ?? -1) ?? 0)
        || (a.label ?? "").localeCompare(b.label ?? "", "fr", { numeric: true })),
    [classes, selectedLevels, levelOrder],
  );

  function toggleLevel(id: number) {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    // Un changement de niveaux invalide les classes déjà choisies (hors du nouveau filtre).
    setRows([emptyRow()]);
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }
  function addRow() { setRows((prev) => [...prev, emptyRow()]); }
  function removeRow(i: number) { setRows((prev) => prev.filter((_, idx) => idx !== i)); }

  async function save() {
    const valid = rows.filter((r) => r.classId && r.subjectId);
    if (valid.length === 0) return;
    setSaving(true);
    try {
      for (const r of valid) {
        // Coefficient omis : la matière est déjà affectée à la classe, on ne fait qu'y attribuer
        // l'enseignant (le coefficient existant est conservé côté serveur).
        await assignClassSubject(Number(r.classId), Number(r.subjectId), teacherId);
      }
      // Fusionne (sans écraser) avec les indicateurs déjà présents, pour rester cohérent avec
      // d'éventuelles affectations faites ailleurs (ex. fiche de la classe).
      const [prevClasses, prevSubjects] = await Promise.all([getAssignedClasses(teacherId), getAssignedSubjects(teacherId)]);
      const classIds = [...new Set([...prevClasses, ...valid.map((r) => Number(r.classId))])];
      const subjectIds = [...new Set([...prevSubjects, ...valid.map((r) => Number(r.subjectId))])];
      await Promise.all([setAssignedClasses(teacherId, classIds), setAssignedSubjects(teacherId, subjectIds)]);
      notifySuccess(`${valid.length} affectation(s) enregistrée(s) — visible dans l'emploi du temps`);
      setSaved(valid.length);
      setRows([emptyRow()]);
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  if (classesQuery.loading || levelsQuery.loading) {
    return <div className="flex justify-center py-6"><Spinner /></div>;
  }

  return (
    <div className="space-y-3">
      <Field>
        <Label>Niveaux où l&apos;enseignant évolue</Label>
        <p className="text-xs text-gray-400">Ex. de la 7ème à la 10ème — filtre les classes proposées ci-dessous</p>
        <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 p-2">
          {levels.length === 0 && <p className="px-1 py-1 text-sm text-gray-400">Aucun niveau.</p>}
          {[...levels].sort((a, b) => a.sortOrder - b.sortOrder).map((l) => {
            const active = selectedLevels.has(l.id);
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => toggleLevel(l.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  active ? "bg-brand-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {l.label}
              </button>
            );
          })}
        </div>
      </Field>

      <Label>Classes & matières enseignées</Label>
      {rows.map((r, i) => (
        <ClassSubjectRow
          key={r.key}
          row={r}
          classes={filteredClasses}
          canRemove={rows.length > 1}
          onChange={(patch) => update(i, patch)}
          onRemove={() => removeRow(i)}
        />
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" size="sm" onClick={addRow} leftSection={<Plus className="h-4 w-4" />}>
          Ajouter une classe
        </Button>
        <Button size="sm" onClick={save} loading={saving}>Enregistrer</Button>
      </div>
      {saved != null && <p className="text-xs text-gray-400">{saved} affectation(s) déjà enregistrée(s) sur cette page.</p>}
    </div>
  );
}

/** Une ligne classe+matière : les matières proposées sont celles déjà affectées à la classe choisie
 * (curriculum défini par le Directeur des Études), pas le catalogue complet. */
function ClassSubjectRow({
  row, classes, canRemove, onChange, onRemove,
}: {
  row: Row;
  classes: { id: number; label: string }[];
  canRemove: boolean;
  onChange: (patch: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const classId = row.classId ? Number(row.classId) : null;
  const classSubjectsQuery = useQuery(() => (classId ? listClassSubjects(classId) : Promise.resolve([])), [classId]);
  const subjectsQuery = useQuery(listSubjects, []);
  const subjectLabel = useMemo(
    () => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])),
    [subjectsQuery.data],
  );
  const assignedSubjects: ClasseMatiere[] = classSubjectsQuery.data ?? [];

  // La matière choisie devient invalide si elle n'est plus dans le curriculum de la classe (changement de classe).
  useEffect(() => {
    if (row.subjectId && !assignedSubjects.some((cm) => String(cm.subjectId) === row.subjectId)) {
      onChange({ subjectId: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ne réagir qu'au changement de classe/curriculum
  }, [classId, classSubjectsQuery.data]);

  return (
    <div className="flex flex-nowrap items-end gap-2">
      <Field>
        <Select value={row.classId} onChange={(e) => onChange({ classId: e.target.value, subjectId: "" })}>
          <option value="">— Classe —</option>
          {classes.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
        </Select>
      </Field>
      <Field>
        <Select value={row.subjectId} disabled={!classId} onChange={(e) => onChange({ subjectId: e.target.value })}>
          <option value="">{classId ? "— Matière —" : "Choisir une classe d'abord"}</option>
          {assignedSubjects.map((cm) => (
            <option key={cm.subjectId} value={cm.subjectId}>{subjectLabel.get(cm.subjectId) ?? `#${cm.subjectId}`}</option>
          ))}
        </Select>
        {classId && !classSubjectsQuery.loading && assignedSubjects.length === 0 && (
          <p className="mt-1 text-xs text-gray-400">Aucune matière affectée à cette classe pour l&apos;instant.</p>
        )}
      </Field>
      <Button type="button" variant="ghost" className="text-error-600" disabled={!canRemove}
        onClick={onRemove} aria-label="Retirer la ligne">
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { useAuth } from "@/providers/auth-provider";
import { addTeacherAvailability, deleteTeacherAvailability, getTeacherAvailability, getTeacherSubjects } from "@/lib/api/staff";
import { listAcademicYears, listClasses, listSubjects } from "@/lib/api/academics";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notifyError, notifySuccess } from "@/lib/feedback";

const DAYS: { value: string; label: string }[] = [
  { value: "LUNDI", label: "Lundi" },
  { value: "MARDI", label: "Mardi" },
  { value: "MERCREDI", label: "Mercredi" },
  { value: "JEUDI", label: "Jeudi" },
  { value: "VENDREDI", label: "Vendredi" },
  { value: "SAMEDI", label: "Samedi" },
];
const hhmm = (t: string) => t?.slice(0, 5) ?? "";

/**
 * Éditeur des disponibilités d'un enseignant (jour + plage horaire). Une disponibilité est
 * toujours déclarée pour une classe et une matière que l'enseignant enseigne réellement (issues de
 * ses affectations ClasseMatiere) — jamais un créneau ouvert — pour alimenter directement la grille
 * d'emploi du temps sans ambiguïté sur ce qui doit y être planifié.
 */
export function TeacherAvailabilitySection({ teacherId, canWrite }: { teacherId: number; canWrite: boolean }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const q = useQuery(() => getTeacherAvailability(teacherId), [teacherId]);
  const assignmentsQuery = useQuery(() => getTeacherSubjects(teacherId), [teacherId]);
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const currentYearId = (yearsQuery.data ?? []).find((y) => y.current)?.id ?? (yearsQuery.data ?? [])[0]?.id ?? null;
  const classesQuery = useQuery(() => (currentYearId ? listClasses(currentYearId) : Promise.resolve([])), [currentYearId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, listSubjects, [tenantId]);

  const classLabel = useMemo(() => new Map((classesQuery.data ?? []).map((c) => [c.id, c.label])), [classesQuery.data]);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);

  // Combinaisons classe+matière réellement enseignées par ce professeur (ClasseMatiere) : seules
  // options proposées, pour ne jamais déclarer une disponibilité sur une classe/matière qu'il ne donne pas.
  const comboOptions = (assignmentsQuery.data ?? []).map((a) => ({
    value: `${a.classId}:${a.subjectId}`,
    label: `${classLabel.get(a.classId) ?? `Classe #${a.classId}`} — ${subjectLabel.get(a.subjectId) ?? `Matière #${a.subjectId}`}`,
  }));

  const [combo, setCombo] = useState("");
  const [day, setDay] = useState("LUNDI");
  const [start, setStart] = useState("08:00");
  const [end, setEnd] = useState("12:00");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!combo) { notifyError("Choisissez la classe et la matière concernées."); return; }
    if (!start || !end || end <= start) { notifyError("Plage horaire invalide."); return; }
    const [classIdStr, subjectIdStr] = combo.split(":");
    setSaving(true);
    try {
      await addTeacherAvailability(teacherId, {
        day, startTime: start, endTime: end,
        schoolClassId: Number(classIdStr), subjectId: Number(subjectIdStr),
      });
      notifySuccess("Disponibilité ajoutée");
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }
  async function remove(id: number) {
    try { await deleteTeacherAvailability(id); notifySuccess("Disponibilité supprimée"); q.refetch(); }
    catch (err) { notifyError(err); }
  }

  const byDay = DAYS.map((d) => ({ ...d, slots: (q.data ?? []).filter((s) => s.day === d.value) }));

  return (
    <div className="space-y-4">
      {q.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {byDay.map((d) => (
            <div key={d.value} className="rounded-xl border border-gray-200 p-3">
              <p className="mb-2 text-xs font-semibold uppercase text-gray-500">{d.label}</p>
              {d.slots.length === 0 ? (
                <p className="text-xs text-gray-300">—</p>
              ) : (
                <ul className="space-y-2">
                  {d.slots.map((s) => (
                    <li key={s.id} className="flex items-start justify-between gap-2 text-sm text-gray-700">
                      <div>
                        <span className="font-medium">{hhmm(s.startTime)} – {hhmm(s.endTime)}</span>
                        <p className="text-xs text-gray-400">
                          {s.schoolClassId != null ? (classLabel.get(s.schoolClassId) ?? `Classe #${s.schoolClassId}`) : "—"}
                          {" · "}
                          {s.subjectId != null ? (subjectLabel.get(s.subjectId) ?? `Matière #${s.subjectId}`) : "—"}
                        </p>
                      </div>
                      {canWrite && (
                        <button type="button" onClick={() => remove(s.id)} className="mt-0.5 text-error-500 hover:text-error-700" aria-label="Supprimer">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && (
        <div className="space-y-3 rounded-xl border border-gray-200 p-3">
          <Field>
            <Label>
              Classe — Matière <span className="text-error-500">*</span>
            </Label>
            <Select value={combo} onChange={(e) => setCombo(e.target.value)}>
              <option value="">— Choisir —</option>
              {comboOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </Select>
            {comboOptions.length === 0 && (
              <p className="text-xs text-warning-600">Aucune matière n&apos;est encore affectée à cet enseignant dans une classe.</p>
            )}
          </Field>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field>
              <Label>Jour</Label>
              <Select className="sm:w-40" value={day} onChange={(e) => setDay(e.target.value)}>
                {DAYS.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
              </Select>
            </Field>
            <Field>
              <Label>Début</Label>
              <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field>
              <Label>Fin</Label>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Button onClick={add} loading={saving}>Ajouter</Button>
          </div>
        </div>
      )}
    </div>
  );
}

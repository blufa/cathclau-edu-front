"use client";

import { useMemo, useState } from "react";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { assignClassSubject, listAcademicYears, listClasses } from "@/lib/api/academics";
import type { Matiere } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label, Field } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Affectation en masse (§retour utilisateur : "je peux choisir plusieurs matières et les affecter à
 * plusieurs classes en même temps") — une case par matière et par classe, l'affectation elle-même
 * réutilise `assignClassSubject` (déjà idempotent côté backend, voir ClasseService#assignSubject :
 * rejouer l'affectation sur une paire déjà existante met juste à jour, ne duplique jamais), appelé
 * une fois par paire (matière × classe) sélectionnée. Coefficient/enseignant restent à régler ensuite
 * au cas par cas sur la fiche de la classe — cet outil ne fait que la mise en relation initiale. */
export function BulkAssignSubjectsModal({ open, onClose, subjects }: {
  open: boolean; onClose: () => void; subjects: Matiere[];
}) {
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? defaultYearId;

  const classesQuery = useCachedQuery(
    effectiveYearId ? `classes:${effectiveYearId}` : null,
    () => listClasses(effectiveYearId as number),
    [effectiveYearId],
  );
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);

  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id]);
  }

  async function submit() {
    if (subjectIds.length === 0 || classIds.length === 0) {
      notifyError("Choisissez au moins une matière et une classe.");
      return;
    }
    setSubmitting(true);
    try {
      const pairs = subjectIds.flatMap((sid) => classIds.map((cid) => ({ subjectId: Number(sid), classId: Number(cid) })));
      const results = await Promise.allSettled(pairs.map((p) => assignClassSubject(p.classId, p.subjectId)));
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed === 0) {
        notifySuccess(`${pairs.length} affectation(s) enregistrée(s).`);
      } else {
        notifyError(`${pairs.length - failed} affectation(s) réussie(s), ${failed} échec(s).`);
      }
      setSubjectIds([]);
      setClassIds([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Affecter des matières à des classes">
      <div className="space-y-4">
        <Field>
          <Label>Année</Label>
          <Select value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
            {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <div className="flex items-center justify-between">
              <Label>Matières <span className="text-error-500">*</span></Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-brand-600 hover:underline"
                  onClick={() => setSubjectIds(subjects.map((s) => String(s.id)))}>Tout cocher</button>
                <button type="button" className="text-gray-400 hover:underline" onClick={() => setSubjectIds([])}>Tout décocher</button>
              </div>
            </div>
            <div className="mt-1.5 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {subjects.length === 0 && <p className="py-4 text-center text-xs text-gray-400">Aucune matière.</p>}
              {subjects.map((s) => (
                <label key={s.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={subjectIds.includes(String(s.id))}
                    onChange={() => toggle(subjectIds, setSubjectIds, String(s.id))}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
                  {s.label}
                </label>
              ))}
            </div>
          </Field>

          <Field>
            <div className="flex items-center justify-between">
              <Label>Classes <span className="text-error-500">*</span></Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-brand-600 hover:underline"
                  onClick={() => setClassIds(classes.map((c) => String(c.id)))}>Tout cocher</button>
                <button type="button" className="text-gray-400 hover:underline" onClick={() => setClassIds([])}>Tout décocher</button>
              </div>
            </div>
            <div className="mt-1.5 max-h-56 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {classes.length === 0 && <p className="py-4 text-center text-xs text-gray-400">Aucune classe cette année.</p>}
              {classes.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={classIds.includes(String(c.id))}
                    onChange={() => toggle(classIds, setClassIds, String(c.id))}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
                  {c.label}
                </label>
              ))}
            </div>
          </Field>
        </div>

        {subjectIds.length > 0 && classIds.length > 0 && (
          <p className="text-xs text-gray-400">
            {subjectIds.length} matière(s) × {classIds.length} classe(s) = {subjectIds.length * classIds.length} affectation(s).
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Annuler</Button>
          <Button onClick={submit} loading={submitting}>Affecter</Button>
        </div>
      </div>
    </Modal>
  );
}

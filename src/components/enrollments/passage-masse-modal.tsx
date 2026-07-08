"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/hooks/use-query";
import { getClassStudents, listAcademicYears, listClasses, listLevels } from "@/lib/api/academics";
import { reenroll } from "@/lib/api/enrollments";
import type { Classe, Niveau } from "@/lib/types/academics";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { notifyError, notifySuccess } from "@/lib/feedback";

/** Section d'une classe = dernier jeton du libellé ("7e A" → "A", "Terminale S" → "S"). */
function sectionOf(label: string): string {
  const parts = label.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/** Classe suivante proposée : niveau immédiatement supérieur (sortOrder) + même section, dans l'année cible. */
function proposeNextClass(source: Classe | undefined, levels: Niveau[], targetClasses: Classe[]): Classe | null {
  if (!source) return null;
  const lvl = levels.find((l) => l.id === source.levelId);
  if (!lvl) return null;
  const next = levels.filter((l) => l.sortOrder > lvl.sortOrder).sort((a, b) => a.sortOrder - b.sortOrder)[0];
  if (!next) return null;
  const atLevel = targetClasses.filter((c) => c.levelId === next.id);
  const sec = sectionOf(source.label);
  return atLevel.find((c) => sectionOf(c.label) === sec) ?? atLevel[0] ?? null;
}

export function PassageMasseModal({ open, onClose, onDone }: {
  open: boolean; onClose: () => void; onDone: () => void;
}) {
  const yearsQuery = useQuery(listAcademicYears, []);
  const levelsQuery = useQuery(listLevels, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const levels = useMemo(() => levelsQuery.data ?? [], [levelsQuery.data]);

  const [sourceYearId, setSourceYearId] = useState<string>("");
  const [targetYearId, setTargetYearId] = useState<string>("");
  const [sourceClassId, setSourceClassId] = useState<string>("");
  const [targetOverride, setTargetOverride] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const sourceClassesQuery = useQuery(
    () => (sourceYearId ? listClasses(Number(sourceYearId)) : Promise.resolve([])), [sourceYearId]);
  const targetClassesQuery = useQuery(
    () => (targetYearId ? listClasses(Number(targetYearId)) : Promise.resolve([])), [targetYearId]);
  const sourceClasses = useMemo(() => sourceClassesQuery.data ?? [], [sourceClassesQuery.data]);
  const targetClasses = useMemo(() => targetClassesQuery.data ?? [], [targetClassesQuery.data]);

  const studentsQuery = useQuery(
    () => (sourceClassId ? getClassStudents(Number(sourceClassId)) : Promise.resolve([])), [sourceClassId]);
  const students = studentsQuery.data ?? [];

  const sourceClass = sourceClasses.find((c) => String(c.id) === sourceClassId);
  const proposed = useMemo(
    () => proposeNextClass(sourceClass, levels, targetClasses),
    [sourceClass, levels, targetClasses]);
  const targetClassId = targetOverride ?? (proposed ? String(proposed.id) : "");

  async function submit() {
    if (!targetYearId || !targetClassId) { notifyError("Choisissez l'année et la classe cibles."); return; }
    if (students.length === 0) { notifyError("Aucun élève dans la classe source."); return; }
    setSubmitting(true);
    let ok = 0; const errors: string[] = [];
    for (const s of students) {
      try {
        await reenroll({ studentId: s.id, classId: Number(targetClassId), academicYearId: Number(targetYearId), type: "RE_ENROLLMENT" });
        ok++;
      } catch { errors.push(`${s.firstName} ${s.lastName}`); }
    }
    setSubmitting(false);
    if (ok > 0) notifySuccess(`${ok} élève(s) réinscrit(s)`);
    if (errors.length > 0) notifyError(`Échec pour : ${errors.slice(0, 5).join(", ")}${errors.length > 5 ? "…" : ""}`);
    onDone();
    if (errors.length === 0) onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title="Passage en masse (réinscription)">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Année source</label>
            <Select value={sourceYearId} onChange={(e) => { setSourceYearId(e.target.value); setSourceClassId(""); }}>
              <option value="">—</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Classe source</label>
            <Select value={sourceClassId} onChange={(e) => { setSourceClassId(e.target.value); setTargetOverride(null); }} disabled={!sourceYearId}>
              <option value="">—</option>
              {sourceClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Année cible</label>
            <Select value={targetYearId} onChange={(e) => { setTargetYearId(e.target.value); setTargetOverride(null); }}>
              <option value="">—</option>
              {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>)}
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Classe cible {proposed && !targetOverride && <span className="text-emerald-600">(proposée)</span>}
            </label>
            <Select value={targetClassId} onChange={(e) => setTargetOverride(e.target.value)} disabled={!targetYearId}>
              <option value="">—</option>
              {targetClasses.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </div>
        </div>

        {sourceClassId && proposed && (
          <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {sourceClass?.label} → <strong>{proposed.label}</strong> (classe suivante proposée automatiquement).
          </p>
        )}
        {sourceClassId && !proposed && targetYearId && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Aucune classe suivante trouvée dans l&apos;année cible — choisissez-la manuellement.
          </p>
        )}

        <div className="rounded-xl border border-slate-200">
          <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">
            Élèves à réinscrire {sourceClassId && `(${students.length})`}
          </div>
          {studentsQuery.loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : students.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-400">Sélectionnez une classe source.</p>
          ) : (
            <ul className="max-h-48 divide-y divide-slate-50 overflow-auto text-sm">
              {students.map((s) => (
                <li key={s.id} className="px-3 py-1.5 text-slate-700">{s.firstName} {s.lastName} <span className="text-slate-400">· {s.studentNumber}</span></li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={submitting}>Annuler</Button>
          <Button onClick={submit} loading={submitting} disabled={!targetClassId || students.length === 0}>
            Réinscrire la classe ({students.length})
          </Button>
        </div>
      </div>
    </Modal>
  );
}

"use client";

import { useMemo, useState } from "react";
import { listAcademicYears, listClasses } from "@/lib/api/academics";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { attachEnrollmentToQueuedStudent } from "@/lib/offline/sync-engine";
import type { EnrollmentType } from "@/lib/types/student";
import { Button } from "@/components/ui/button";
import { Field, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { notifyError, notifySuccess } from "@/lib/feedback";

/**
 * Formulaire d'inscription volontairement simplifié pour un élève encore provisoire (créé hors-ligne,
 * pas encore synchronisé — §students, Phase 2 hors-ligne) : année + classe uniquement. Contrairement à
 * `EnrollModal` (features/enrollments/components/enroll-modal.tsx), pas d'historique de réinscription
 * ni d'abonnements transport/cantine — ces à-côtés nécessitent un `studentId` réel et resteront à
 * compléter après synchronisation, comme un agent peut déjà le faire aujourd'hui en fermant
 * `EnrollModal` sans inscrire tout de suite.
 */
export function OfflineEnrollFields({
  entryId, onDone, onSkip,
}: {
  entryId: string;
  onDone: () => void;
  onSkip: () => void;
}) {
  const yearsQuery = useCachedQuery("academic-years", listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? defaultYearId;

  const classesQuery = useCachedQuery(
    effectiveYearId != null ? `classes:${effectiveYearId}` : null,
    () => listClasses(effectiveYearId as number),
    [effectiveYearId],
  );
  const classes = classesQuery.data ?? [];
  const [classId, setClassId] = useState("");
  const [type, setType] = useState<EnrollmentType>("NEW");
  const [submitting, setSubmitting] = useState(false);

  async function handleAttach() {
    if (!effectiveYearId || !classId) return;
    setSubmitting(true);
    try {
      await attachEnrollmentToQueuedStudent(entryId, {
        classId: Number(classId), academicYearId: effectiveYearId, type,
      });
      notifySuccess("Classe enregistrée — l'inscription sera synchronisée avec l'élève.");
      onDone();
    } catch (err) {
      notifyError(err);
    } finally {
      setSubmitting(false);
    }
  }

  const noDataOffline = !yearsQuery.loading && years.length === 0 && yearsQuery.error != null;

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-warning-50 px-3 py-2 text-sm text-warning-800">
        Élève enregistré hors-ligne — l&apos;inscription sera synchronisée avec lui dès le retour de la
        connexion. Vous pouvez choisir sa classe maintenant, ou le faire plus tard.
      </p>

      {noDataOffline ? (
        <p className="rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-500">
          Liste des classes indisponible hors-ligne (jamais chargée depuis que vous êtes connecté).
          Complétez l&apos;inscription une fois la connexion rétablie.
        </p>
      ) : (
        <>
          <Field>
            <Label htmlFor="offline-year">Année scolaire</Label>
            <Select
              id="offline-year"
              value={effectiveYearId ?? ""}
              onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}
            >
              {years.length === 0 && <option value="">—</option>}
              {years.map((y) => (
                <option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>
              ))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="offline-class">Classe</Label>
            <Select id="offline-class" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Sélectionner…</option>
              {classes.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
            </Select>
          </Field>

          <Field>
            <Label htmlFor="offline-type">Type</Label>
            <Select id="offline-type" value={type} onChange={(e) => setType(e.target.value as EnrollmentType)}>
              <option value="NEW">Inscription (nouvel élève)</option>
              <option value="RE_ENROLLMENT">Réinscription</option>
            </Select>
          </Field>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onSkip} disabled={submitting}>
          Inscrire plus tard
        </Button>
        <Button type="button" onClick={handleAttach} loading={submitting} disabled={!classId || !effectiveYearId}>
          Inscrire
        </Button>
      </div>
    </div>
  );
}

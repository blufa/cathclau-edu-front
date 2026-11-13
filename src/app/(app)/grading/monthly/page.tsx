"use client";

/**
 * Évaluations mensuelles (§censeur) : diagnostic de niveau en cours d'année, saisi dans la période
 * semestrielle/trimestrielle en cours (pas une nouvelle période — seul le TYPE change, voir
 * AssessmentType.MONTHLY) mais toujours tenu séparé des écrans "Évaluations & notes" normaux (page
 * dédiée, jamais un onglet de plus sur /grading) — "il ne faut pas les mélanger avec la liste des
 * évaluations normales". Alimente le bulletin mensuel (/grading/monthly-report-cards).
 */

import { Fragment, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses, listSubjects } from "@/lib/api/academics";
import { deleteAssessment, getAssessmentGradeSheetPdfObjectUrl, listAssessmentsByClass } from "@/lib/api/grading";
import type { Assessment } from "@/lib/types/grading";
import { AssessmentForm, GradeGrid } from "@/components/grading/assessment-editor";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { FilePreview } from "@/components/ui/file-preview";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/format";

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
function monthKeyOf(a: Assessment): string {
  return a.date ? a.date.slice(0, 7) : "sans-date";
}
function monthLabelOf(key: string): string {
  if (key === "sans-date") return "Sans date";
  const [y, m] = key.split("-");
  return `${MONTHS_FR[Number(m) - 1] ?? m} ${y}`;
}

export default function MonthlyEvaluationsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER") || hasAnyPermission(user, ["evaluation:create"]);
  const canEditExisting = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR") || hasAnyPermission(user, ["note:unlock"]);

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
  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );
  const [classId, setClassId] = useState<number | null>(null);

  const tenantId = user?.tenantId ?? null;
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, () => listSubjects(), [tenantId]);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);

  const assessmentsQuery = useCachedQuery(classId ? `assessments-class:${classId}` : null, () => listAssessmentsByClass(classId as number), [classId]);
  const monthly = useMemo(() => (assessmentsQuery.data ?? []).filter((a) => a.type === "MONTHLY"), [assessmentsQuery.data]);
  const groups = useMemo(() => {
    const map = new Map<string, Assessment[]>();
    for (const a of monthly) {
      const key = monthKeyOf(a);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthly]);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [gradingFor, setGradingFor] = useState<Assessment | null>(null);
  const [gradeSheetUrl, setGradeSheetUrl] = useState<string | null>(null);
  const [gradeSheetLoadingId, setGradeSheetLoadingId] = useState<number | null>(null);

  async function openGradeSheet(a: Assessment) {
    setGradeSheetLoadingId(a.id);
    try { setGradeSheetUrl(await getAssessmentGradeSheetPdfObjectUrl(a.id)); }
    catch (err) { notifyError(err); } finally { setGradeSheetLoadingId(null); }
  }

  function handleDelete(a: Assessment) {
    confirmAction({
      title: "Supprimer l'évaluation mensuelle", message: `Supprimer « ${a.label} » et ses notes ?`,
      confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteAssessment(a.id); notifySuccess("Évaluation supprimée"); assessmentsQuery.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Évaluations mensuelles</h1>
        <p className="text-sm text-gray-500">
          Contrôle de niveau en cours d&apos;année, distinct des évaluations normales — alimente le{" "}
          <a href="/grading/monthly-report-cards" className="text-brand-600 hover:underline">bulletin mensuel</a>,
          jamais la moyenne du semestre.
        </p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Label>Année</Label>
          <Select value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
            {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
          </Select>
        </div>
        <div className="w-56">
          <Label>Classe</Label>
          <SearchableSelect
            value={classId != null ? String(classId) : ""}
            options={classOptions}
            onChange={(v) => setClassId(v ? Number(v) : null)}
            triggerClassName="w-full justify-between px-3"
          />
        </div>
        {classId && canWrite && (
          <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle évaluation mensuelle</Button>
        )}
      </div>

      {!classId ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">Sélectionnez une classe.</p>
      ) : assessmentsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead>
            <tr>
              <TH>Évaluation</TH>
              <TH className="hidden sm:table-cell">Matière</TH>
              <TH className="hidden sm:table-cell">Barème</TH>
              <TH className="hidden sm:table-cell">Date</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {groups.length === 0 && (
              <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucune évaluation mensuelle.</TD></TR>
            )}
            {groups.map(([monthKey, evals]) => (
              <Fragment key={monthKey}>
                <TR>
                  <TD colSpan={100} className="bg-gray-50 font-semibold text-gray-700">
                    {monthLabelOf(monthKey)}
                    <span className="ml-2 font-normal text-gray-400">
                      {evals.length} évaluation{evals.length > 1 ? "s" : ""}
                    </span>
                  </TD>
                </TR>
                {evals.map((a) => (
                  <TR key={a.id}>
                    <TD className="font-medium text-gray-900">{a.label}</TD>
                    <TD className="hidden sm:table-cell">{subjectLabel.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                    <TD className="hidden sm:table-cell">/ {a.maxScore}</TD>
                    <TD className="hidden sm:table-cell">{formatDate(a.date)}</TD>
                    <TD className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" onClick={() => setGradingFor(a)}>Saisir les notes</Button>
                        <Button size="sm" variant="ghost" loading={gradeSheetLoadingId === a.id} onClick={() => openGradeSheet(a)}>PDF</Button>
                        {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Modifier</Button>}
                        {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(a)}>Suppr.</Button>}
                      </div>
                    </TD>
                  </TR>
                ))}
              </Fragment>
            ))}
          </TBody>
        </Table>
      )}

      {classId && (
        <>
          <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle évaluation mensuelle">
            <AssessmentForm classId={classId} yearId={effectiveYearId} defaultType="MONTHLY" onCancel={() => setCreating(false)}
              onCreated={() => { setCreating(false); notifySuccess("Évaluation mensuelle créée"); assessmentsQuery.refetch(); }} />
          </Modal>
          <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'évaluation mensuelle">
            {editing && (
              <AssessmentForm classId={classId} yearId={effectiveYearId} initial={editing} defaultType="MONTHLY" onCancel={() => setEditing(null)}
                onCreated={() => { setEditing(null); notifySuccess("Évaluation modifiée"); assessmentsQuery.refetch(); }} />
            )}
          </Modal>
          <Modal open={!!gradingFor} onClose={() => setGradingFor(null)} title={`Notes — ${gradingFor?.label ?? ""}`}>
            {gradingFor && <GradeGrid assessment={gradingFor} canWrite={canWrite} canEditExisting={canEditExisting} onDone={() => setGradingFor(null)} />}
          </Modal>
          <FilePreview url={gradeSheetUrl} title="Fiche de notes" open={gradeSheetUrl != null} onClose={() => setGradeSheetUrl(null)} autoPrint />
        </>
      )}
    </div>
  );
}

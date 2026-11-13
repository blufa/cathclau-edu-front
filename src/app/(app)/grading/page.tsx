"use client";

import { Fragment, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";
import { hasAnyPermission, hasRole } from "@/lib/auth/permissions";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import { listAcademicYears, listClasses, listPeriods, listSubjects } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import {
  deleteAssessment,
  getAssessmentGradeSheetPdfObjectUrl,
  getSubjectGradeReportPdfObjectUrl,
  listAssessmentsByClass,
} from "@/lib/api/grading";
import { ASSESSMENT_TYPE_LABEL, type Assessment } from "@/lib/types/grading";
import { AssessmentForm, GradeGrid } from "@/components/grading/assessment-editor";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Label, Field } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { FilePreview } from "@/components/ui/file-preview";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatDate } from "@/lib/format";
import { FileText, Plus } from "lucide-react";

export default function GradingPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER") || hasAnyPermission(user, ["evaluation:create"]);
  // Only admins/directors may modify an already-entered grade; teachers can only enter new ones.
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
  // Deep-link from the teacher space: /grading?class=ID preselects the class.
  const searchParams = useSearchParams();
  const [classId, setClassId] = useState<number | null>(() => {
    const c = searchParams.get("class");
    return c ? Number(c) : null;
  });

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Évaluations & notes</h1>
        <p className="text-sm text-gray-500">Interrogations et devoirs, saisie des notes par classe</p>
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
      </div>

      {!classId ? (
        <p className="rounded-xl bg-gray-50 px-4 py-8 text-center text-sm text-gray-400">
          Sélectionnez une classe.
        </p>
      ) : (
        <EvaluationsTab classId={classId}
          yearId={effectiveYearId} canWrite={canWrite} canEditExisting={canEditExisting} />
      )}
    </div>
  );
}

// Regroupement mensuel des évaluations : chaque mois, une matière a généralement 2 évaluations
// (ex. orale + écrite) et une moyenne mensuelle = moyenne pondérée (par coefficient) ramenée sur 20.
const MONTHS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
function monthKeyOf(a: Assessment): string {
  return a.date ? a.date.slice(0, 7) : "sans-date";
}
function monthLabelOf(key: string): string {
  if (key === "sans-date") return "Sans date";
  const [y, m] = key.split("-");
  return `${MONTHS_FR[Number(m) - 1] ?? m} ${y}`;
}

// ── Évaluations tab ──────────────────────────────────────────────────────────
function EvaluationsTab({ classId, yearId, canWrite, canEditExisting }: { classId: number; yearId: number | null; canWrite: boolean; canEditExisting: boolean }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const assessmentsQuery = useCachedQuery(`assessments-class:${classId}`, () => listAssessmentsByClass(classId), [classId]);
  const subjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, () => listSubjects(), [tenantId]);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);
  const teacherLabel = useMemo(() => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachersQuery.data]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Assessment | null>(null);
  const [gradingFor, setGradingFor] = useState<Assessment | null>(null);
  // Relevé de notes par matière (PDF backend, moyenne calculée selon le paramétrage de l'établissement).
  const periodsQuery = useCachedQuery(yearId ? `periods:${yearId}` : null, () => listPeriods(yearId as number), [yearId]);
  const [releveOpen, setReleveOpen] = useState(false);
  const [releveSubject, setReleveSubject] = useState<string>("");
  const [relevePeriod, setRelevePeriod] = useState<string>("");
  const [releveUrl, setReleveUrl] = useState<string | null>(null);
  const [releveLoading, setReleveLoading] = useState(false);
  async function openReleve() {
    if (!releveSubject || !relevePeriod) return;
    setReleveLoading(true);
    try {
      setReleveUrl(await getSubjectGradeReportPdfObjectUrl(classId, Number(releveSubject), Number(relevePeriod)));
      setReleveOpen(false);
    } catch (err) {
      notifyError(err);
    } finally {
      setReleveLoading(false);
    }
  }

  // PDF téléchargeable d'une évaluation précise (ex. l'épreuve orale d'octobre) — notes déjà saisies
  // incluses. Remplace l'ancien aperçu window.print() qui ne produisait rien de partageable.
  const [gradeSheetUrl, setGradeSheetUrl] = useState<string | null>(null);
  const [gradeSheetLoadingId, setGradeSheetLoadingId] = useState<number | null>(null);
  async function openGradeSheet(a: Assessment) {
    setGradeSheetLoadingId(a.id);
    try {
      setGradeSheetUrl(await getAssessmentGradeSheetPdfObjectUrl(a.id));
    } catch (err) {
      notifyError(err);
    } finally {
      setGradeSheetLoadingId(null);
    }
  }

  // PDF réel (téléchargeable) du relevé du mois — en plus de l'aperçu imprimable printMonthly().
  const [monthlyPdfUrl, setMonthlyPdfUrl] = useState<string | null>(null);
  const [monthlyPdfLoadingKey, setMonthlyPdfLoadingKey] = useState<string | null>(null);
  async function openMonthlyPdf(group: { subjectId: number; monthKey: string; evals: Assessment[] }) {
    const periodId = group.evals[0]?.periodId;
    if (!periodId || group.monthKey === "sans-date") return;
    const key = `${group.subjectId}|${group.monthKey}`;
    setMonthlyPdfLoadingKey(key);
    try {
      const month = Number(group.monthKey.split("-")[1]);
      setMonthlyPdfUrl(await getSubjectGradeReportPdfObjectUrl(classId, group.subjectId, periodId, month));
    } catch (err) {
      notifyError(err);
    } finally {
      setMonthlyPdfLoadingKey(null);
    }
  }

  const distinctSubjects = useMemo(
    () => [...new Set((assessmentsQuery.data ?? []).map((a) => a.subjectId))],
    [assessmentsQuery.data]);

  // Recherche par matière et par date sur les listes Évaluations/Compositions ci-dessous (la classe
  // est déjà le sélecteur de la page, au-dessus des onglets — pas un 3e filtre ici).
  const [searchSubject, setSearchSubject] = useState<string>("");
  const [searchDate, setSearchDate] = useState<string>("");
  const filteredAssessments = useMemo(
    () => (assessmentsQuery.data ?? []).filter((a) =>
      (!searchSubject || String(a.subjectId) === searchSubject) && (!searchDate || a.date === searchDate)),
    [assessmentsQuery.data, searchSubject, searchDate]);

  // Évaluations (interrogations/devoirs) groupées par (matière, mois) — jamais les compositions, qui
  // ont leur propre liste ci-dessous (compositionGroups) : plus mélangées dans le même tableau/relevé
  // (§retour utilisateur, "il doit avoir les évaluations à part, et une liste des compositions").
  const groups = useMemo(() => {
    const map = new Map<string, { subjectId: number; monthKey: string; evals: Assessment[] }>();
    for (const a of filteredAssessments) {
      if (a.type === "EXAM") continue;
      const key = `${a.subjectId}|${monthKeyOf(a)}`;
      if (!map.has(key)) map.set(key, { subjectId: a.subjectId, monthKey: monthKeyOf(a), evals: [] });
      map.get(key)!.evals.push(a);
    }
    return [...map.values()].sort(
      (x, y) =>
        (subjectLabel.get(x.subjectId) ?? "").localeCompare(subjectLabel.get(y.subjectId) ?? "") ||
        y.monthKey.localeCompare(x.monthKey),
    );
  }, [filteredAssessments, subjectLabel]);

  function handleDelete(a: Assessment) {
    confirmAction({
      title: "Supprimer l'évaluation", message: `Supprimer « ${a.label} » et ses notes ?`,
      confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteAssessment(a.id); notifySuccess("Évaluation supprimée"); assessmentsQuery.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  const subjectFilterOptions: SearchableOption[] = useMemo(
    () => distinctSubjects.map((sid) => {
      const label = subjectLabel.get(sid) ?? `#${sid}`;
      return { value: String(sid), trigger: label, label, searchText: label };
    }),
    [distinctSubjects, subjectLabel],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {distinctSubjects.length > 0 && (
          <div className="flex flex-wrap items-end gap-2">
            <Field>
              <Label>Rechercher — matière</Label>
              <SearchableSelect value={searchSubject} options={subjectFilterOptions} onChange={setSearchSubject} triggerClassName="w-[180px] justify-between px-3" noResultsLabel="Aucune matière" />
            </Field>
            <Field>
              <Label>Rechercher — date</Label>
              <DatePicker value={searchDate} onChange={setSearchDate} clearable />
            </Field>
            {(searchSubject || searchDate) && (
              <Button variant="ghost" onClick={() => { setSearchSubject(""); setSearchDate(""); }}>Réinitialiser</Button>
            )}
          </div>
        )}
        <div className="ml-auto flex flex-wrap items-end gap-2">
          {distinctSubjects.length > 0 && (
            // Relevé PDF : une seule case à côté des champs de recherche au lieu d'une 2e barre de
            // filtres entière (§retour utilisateur : "beaucoup de barres de recherche superposées qui
            // devient moche", surtout en mobile) — les 2 champs nécessaires passent dans un petit modal.
            <Button variant="secondary" size="sm" leftSection={<FileText className="h-4 w-4" />} onClick={() => setReleveOpen(true)}>
              Relevé (PDF)
            </Button>
          )}
          {canWrite && (
            <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle évaluation</Button>
          )}
        </div>
      </div>

      <Modal open={releveOpen} onClose={() => setReleveOpen(false)} title="Relevé de notes (PDF)">
        <div className="space-y-4">
          <Field>
            <Label>Matière</Label>
            <SearchableSelect value={releveSubject} options={subjectFilterOptions} onChange={setReleveSubject} triggerClassName="w-full justify-between px-3" noResultsLabel="Aucune matière" />
          </Field>
          <Field>
            <Label>Période</Label>
            <Select value={relevePeriod} onChange={(e) => setRelevePeriod(e.target.value)}>
              <option value="">Choisir une période</option>
              {(periodsQuery.data ?? []).map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
            </Select>
          </Field>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReleveOpen(false)}>Annuler</Button>
            <Button disabled={!releveSubject || !relevePeriod} loading={releveLoading} onClick={openReleve}>
              Générer
            </Button>
          </div>
        </div>
      </Modal>
      {assessmentsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <>
        <h3 className="text-sm font-semibold text-gray-700">Évaluations</h3>
        <Table>
          <THead>
            <tr>
              <TH>Évaluation</TH>
              <TH className="hidden sm:table-cell">Matière</TH>
              <TH className="hidden sm:table-cell">Enseignant</TH>
              <TH>Type</TH>
              <TH className="hidden sm:table-cell">Barème</TH>
              <TH className="hidden sm:table-cell">Coef.</TH>
              <TH className="hidden sm:table-cell">Date</TH>
              <TH className="text-right">Actions</TH>
            </tr>
          </THead>
          <TBody>
            {groups.length === 0 && (
              <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucune évaluation.</TD></TR>
            )}
            {groups.map((g) => (
              <Fragment key={`${g.subjectId}|${g.monthKey}`}>
                <TR>
                  {/* Une seule cellule sur toute la largeur (colSpan surdimensionné, clampé par le
                      navigateur au nombre réel de colonnes) : le nombre de colonnes visibles varie
                      selon l'écran (colonnes masquées sur mobile ci-dessus), une seconde cellule à
                      côté casserait l'alignement. */}
                  <TD colSpan={100} className="bg-gray-50 font-semibold text-gray-700">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {subjectLabel.get(g.subjectId) ?? `#${g.subjectId}`} · {monthLabelOf(g.monthKey)}
                        <span className="ml-2 font-normal text-gray-400">
                          {g.evals.length} évaluation{g.evals.length > 1 ? "s" : ""}
                        </span>
                      </span>
                      <Button size="sm" variant="secondary"
                        loading={monthlyPdfLoadingKey === `${g.subjectId}|${g.monthKey}`}
                        onClick={() => openMonthlyPdf(g)}>Relevé du mois (PDF)</Button>
                    </div>
                  </TD>
                </TR>
                {g.evals.map((a) => (
                  <TR key={a.id}>
                    <TD className="pl-6 font-medium text-gray-900">{a.label}</TD>
                    <TD className="hidden sm:table-cell">{subjectLabel.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                    <TD className="hidden sm:table-cell">{a.teacherId ? (teacherLabel.get(a.teacherId) ?? `#${a.teacherId}`) : "—"}</TD>
                    <TD><Badge tone="indigo">{ASSESSMENT_TYPE_LABEL[a.type]}</Badge></TD>
                    <TD className="hidden sm:table-cell">/ {a.maxScore}</TD>
                    <TD className="hidden sm:table-cell">{a.coefficient}</TD>
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
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle évaluation">
        <AssessmentForm classId={classId} yearId={yearId} onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); notifySuccess("Évaluation créée"); assessmentsQuery.refetch(); }} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'évaluation">
        {editing && (
          <AssessmentForm classId={classId} yearId={yearId} initial={editing} onCancel={() => setEditing(null)}
            onCreated={() => { setEditing(null); notifySuccess("Évaluation modifiée"); assessmentsQuery.refetch(); }} />
        )}
      </Modal>
      <Modal open={!!gradingFor} onClose={() => setGradingFor(null)} title={`Notes — ${gradingFor?.label ?? ""}`}>
        {gradingFor && <GradeGrid assessment={gradingFor} canWrite={canWrite} canEditExisting={canEditExisting} onDone={() => setGradingFor(null)} />}
      </Modal>
      <FilePreview url={releveUrl} title="Relevé de notes" open={releveUrl != null} onClose={() => setReleveUrl(null)} autoPrint />
      <FilePreview url={gradeSheetUrl} title="Fiche de notes" open={gradeSheetUrl != null} onClose={() => setGradeSheetUrl(null)} autoPrint />
      <FilePreview url={monthlyPdfUrl} title="Relevé du mois" open={monthlyPdfUrl != null} onClose={() => setMonthlyPdfUrl(null)} autoPrint />
    </div>
  );
}

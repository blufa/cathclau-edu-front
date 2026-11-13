"use client";

import { Fragment, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { useQuery } from "@/hooks/use-query";
import { useCachedQuery } from "@/lib/offline/use-cached-query";
import {
  assignClassSubject,
  listClassSubjects,
  listPeriods,
  listRooms,
  listSubjects,
} from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import {
  assignExamSupervisor,
  completeExam,
  createExam,
  deleteAssessment,
  deleteExam,
  listExamAssessments,
  listExamSupervisions,
  getExamGradeEntryAssessment,
  removeExamSupervision,
  getAssessmentGradeSheetPdfObjectUrl,
  getExamConvocationObjectUrl,
  getSubjectGradeReportPdfObjectUrl,
  listAssessmentsByClass,
  listExamsByClass,
  startExam,
} from "@/lib/api/grading";
import {
  ASSESSMENT_TYPE_LABEL,
  EXAM_STATUS_LABEL,
  EXAM_TYPE_LABEL,
  type Assessment,
  type Exam,
  type ExamType,
} from "@/lib/types/grading";
import { AssessmentForm, GradeGrid } from "@/components/grading/assessment-editor";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { Input, Label, Field } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { FilePreview } from "@/components/ui/file-preview";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { openPdfInApp } from "@/lib/open-pdf";
import { formatDate } from "@/lib/format";

// ── Compositions (domaine "Exam" — type ExamType conservé : Blanc/Semestriel/Annuel/National
// restent des sous-types valides d'une composition) ───────────────────────────
const examSchema = z.object({
  periodId: z.string().min(1, "Requis"),
  type: z.string(),
  label: z.string().trim().min(1, "Requis"),
  scheduledDate: z.string(),
});
type ExamFormValues = z.infer<typeof examSchema>;

export function CompositionsTab({ classId, yearId, canManage, canWrite, canEditExisting }: {
  classId: number; yearId: number | null; canManage: boolean; canWrite: boolean; canEditExisting: boolean;
}) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const examsQuery = useCachedQuery(`exams-class:${classId}`, () => listExamsByClass(classId), [classId]);
  const periodsQuery = useCachedQuery(yearId ? `periods:${yearId}` : null, () => listPeriods(yearId as number), [yearId]);
  const classSubjectsQuery = useCachedQuery(`class-subjects:${classId}`, () => listClassSubjects(classId), [classId]);
  const allSubjectsQuery = useCachedQuery(tenantId ? `subjects:${tenantId}` : null, () => listSubjects(), [tenantId]);
  const subjectName = useMemo(() => new Map((allSubjectsQuery.data ?? []).map((s) => [s.id, s.label])), [allSubjectsQuery.data]);
  const [creating, setCreating] = useState(false);
  const [supervisingFor, setSupervisingFor] = useState<Exam | null>(null);

  // Notes déjà saisies, groupées par (matière, période) — même clé de cache que l'onglet Évaluations
  // (assessments-class), donc aucun appel réseau en double. Tableau déplacé ici (§retour utilisateur :
  // "il faut mettre ce tableau sur le tab de composition") — il vivait par erreur sous l'onglet
  // Évaluations alors qu'il ne porte que des Assessment de type EXAM (compositions).
  const assessmentsQuery = useCachedQuery(`assessments-class:${classId}`, () => listAssessmentsByClass(classId), [classId]);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const teacherLabel = useMemo(() => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachersQuery.data]);
  const periodLabel = useMemo(() => new Map((periodsQuery.data ?? []).map((p) => [p.id, p.label])), [periodsQuery.data]);
  const compositionGroups = useMemo(() => {
    const map = new Map<string, { subjectId: number; periodId: number; evals: Assessment[] }>();
    for (const a of assessmentsQuery.data ?? []) {
      if (a.type !== "EXAM") continue;
      const key = `${a.subjectId}|${a.periodId}`;
      if (!map.has(key)) map.set(key, { subjectId: a.subjectId, periodId: a.periodId, evals: [] });
      map.get(key)!.evals.push(a);
    }
    return [...map.values()].sort(
      (x, y) => (subjectName.get(x.subjectId) ?? "").localeCompare(subjectName.get(y.subjectId) ?? ""));
  }, [assessmentsQuery.data, subjectName]);
  const [editingAssessment, setEditingAssessment] = useState<Assessment | null>(null);
  const [gradeSheetUrl, setGradeSheetUrl] = useState<string | null>(null);
  const [gradeSheetLoadingId, setGradeSheetLoadingId] = useState<number | null>(null);
  async function openGradeSheet(a: Assessment) {
    setGradeSheetLoadingId(a.id);
    try { setGradeSheetUrl(await getAssessmentGradeSheetPdfObjectUrl(a.id)); }
    catch (err) { notifyError(err); } finally { setGradeSheetLoadingId(null); }
  }
  const [compositionPdfUrl, setCompositionPdfUrl] = useState<string | null>(null);
  const [compositionPdfLoadingKey, setCompositionPdfLoadingKey] = useState<string | null>(null);
  async function openCompositionPdf(group: { subjectId: number; periodId: number }) {
    const key = `${group.subjectId}|${group.periodId}`;
    setCompositionPdfLoadingKey(key);
    try { setCompositionPdfUrl(await getSubjectGradeReportPdfObjectUrl(classId, group.subjectId, group.periodId)); }
    catch (err) { notifyError(err); } finally { setCompositionPdfLoadingKey(null); }
  }
  function handleDeleteAssessment(a: Assessment) {
    confirmAction({
      title: "Supprimer l'évaluation", message: `Supprimer « ${a.label} » et ses notes ?`,
      confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => {
        try { await deleteAssessment(a.id); notifySuccess("Évaluation supprimée"); assessmentsQuery.refetch(); }
        catch (err) { notifyError(err); }
      },
    });
  }

  async function changeStatus(e: Exam, action: "start" | "complete") {
    try {
      await (action === "start" ? startExam(e.id) : completeExam(e.id));
      notifySuccess("Statut mis à jour");
      examsQuery.refetch();
    } catch (err) { notifyError(err); }
  }
  async function convocation(e: Exam) {
    try {
      openPdfInApp(await getExamConvocationObjectUrl(e.id), "Convocation");
    } catch (err) { notifyError(err); }
  }
  function handleDelete(e: Exam) {
    confirmAction({
      title: "Supprimer la composition", message: `Supprimer « ${e.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteExam(e.id); notifySuccess("Composition supprimée"); examsQuery.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  const { handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<ExamFormValues>({
    resolver: zodResolver(examSchema),
    defaultValues: { periodId: "", type: "SEMESTER", label: "", scheduledDate: "" },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  // Matières couvertes par la composition — toutes les matières de la classe cochées par défaut
  // (§retour utilisateur : "programmer les compositions pour toutes les matières de la classe en
  // une seule fois, comme pour les évaluations") ; décochables au cas par cas. Une évaluation (type
  // EXAM) est créée pour chaque matière cochée, prête pour la saisie des notes sans repasser par
  // "Saisir les notes" matière par matière.
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjectError, setSubjectError] = useState<string | null>(null);
  // Coefficient par matière — une composition n'a pas de coefficient propre (toujours neutre côté
  // serveur, voir ExamService.gradeEntryAssessment) : c'est le coefficient de la MATIÈRE pour cette
  // classe qui pondère sa moyenne. Réglable ici directement (§retour utilisateur : "meme chose pour la
  // partie composition"), persisté sur la matière de la classe (ClasseMatiere), pas sur la composition.
  const [coefficients, setCoefficients] = useState<Record<string, string>>({});
  function coefFor(sid: string): number {
    const cm = (classSubjectsQuery.data ?? []).find((c) => String(c.subjectId) === sid);
    if (cm?.coefficient != null && !Number.isNaN(Number(cm.coefficient))) return Number(cm.coefficient);
    const subj = (allSubjectsQuery.data ?? []).find((s) => String(s.id) === sid);
    if (subj?.coefficient != null && !Number.isNaN(Number(subj.coefficient))) return Number(subj.coefficient);
    return 1;
  }
  function toggleSubject(sid: string) {
    const checking = !subjectIds.includes(sid);
    setSubjectIds((prev) => (checking ? [...prev, sid] : prev.filter((s) => s !== sid)));
    setSubjectError(null);
    if (checking && coefficients[sid] == null) {
      setCoefficients((prev) => ({ ...prev, [sid]: String(coefFor(sid)) }));
    }
  }
  function openCreate() {
    const ids = (classSubjectsQuery.data ?? []).map((cm) => String(cm.subjectId));
    setSubjectIds(ids);
    setCoefficients(Object.fromEntries(ids.map((sid) => [sid, String(coefFor(sid))])));
    setCreating(true);
  }

  async function submit(values: ExamFormValues) {
    if (subjectIds.length === 0) { setSubjectError("Choisissez au moins une matière"); return; }
    try {
      // Persiste le coefficient par matière AVANT de créer la composition — c'est lui qui pondère la
      // moyenne, pas un coefficient de la composition elle-même.
      for (const sid of subjectIds) {
        const cm = (classSubjectsQuery.data ?? []).find((c) => String(c.subjectId) === sid);
        const wanted = Number(coefficients[sid]);
        if (cm && wanted > 0 && Number(cm.coefficient) !== wanted) {
          try { await assignClassSubject(classId, Number(sid), cm.teacherId ?? undefined, wanted, cm.code ?? undefined, cm.specialty); }
          catch (err) { notifyError(err); }
        }
      }
      const exam = await createExam({ classId, periodId: Number(values.periodId), type: values.type as ExamType, label: values.label, scheduledDate: values.scheduledDate || null });
      // Sans date, l'évaluation de chaque matière ne peut pas encore être créée (voir
      // gradeEntryAssessment côté backend) — la composition reste planifiable, les matières seront
      // prêtes dès qu'une date sera renseignée (via "Saisir les notes").
      if (values.scheduledDate) {
        for (const sid of subjectIds) {
          try { await getExamGradeEntryAssessment(exam.id, Number(sid)); }
          catch (err) { notifyError(err); }
        }
      }
      setCreating(false); reset(); notifySuccess("Composition planifiée"); examsQuery.refetch(); classSubjectsQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  // Saisie des notes par matière (§retour utilisateur : la composition se crée ET se note ici,
  // jamais via "Nouvelle évaluation") — on choisit la matière au moment de saisir les notes, la
  // grille réutilisée est exactement celle des évaluations normales (GradeGrid).
  const [pickingSubjectFor, setPickingSubjectFor] = useState<Exam | null>(null);
  const [gradingFor, setGradingFor] = useState<Assessment | null>(null);
  const [gradedSubjectIds, setGradedSubjectIds] = useState<Set<number>>(new Set());
  const [subjectPickLoading, setSubjectPickLoading] = useState<number | null>(null);

  async function openSubjectPicker(e: Exam) {
    setPickingSubjectFor(e);
    try {
      const already = await listExamAssessments(e.id);
      setGradedSubjectIds(new Set(already.map((a) => a.subjectId)));
    } catch (err) { notifyError(err); }
  }
  async function pickSubject(e: Exam, subjectId: number) {
    setSubjectPickLoading(subjectId);
    try {
      const assessment = await getExamGradeEntryAssessment(e.id, subjectId);
      setPickingSubjectFor(null);
      setGradingFor(assessment);
    } catch (err) { notifyError(err); } finally { setSubjectPickLoading(null); }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={openCreate} leftSection={<Plus className="h-4 w-4" />}>Planifier une composition</Button>
        </div>
      )}
      {examsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Composition</TH><TH>Type</TH><TH>Date</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(examsQuery.data ?? []).length === 0 && (
              <TR><TD colSpan={5} className="py-10 text-center text-gray-400">Aucune composition.</TD></TR>
            )}
            {(examsQuery.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-gray-900">{e.label}</TD>
                <TD>{EXAM_TYPE_LABEL[e.type]}</TD>
                <TD>{formatDate(e.scheduledDate)}</TD>
                <TD><Badge tone={e.status === "COMPLETED" ? "green" : e.status === "ONGOING" ? "amber" : "gray"}>{EXAM_STATUS_LABEL[e.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {canWrite && <Button size="sm" onClick={() => openSubjectPicker(e)}>Saisir les notes</Button>}
                    <Button size="sm" variant="ghost" onClick={() => convocation(e)}>Convocation</Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => setSupervisingFor(e)}>Surveillance</Button>}
                    {canManage && e.status === "PLANNED" && <Button size="sm" variant="ghost" onClick={() => changeStatus(e, "start")}>Démarrer</Button>}
                    {canManage && e.status === "ONGOING" && <Button size="sm" variant="ghost" onClick={() => changeStatus(e, "complete")}>Terminer</Button>}
                    {canManage && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDelete(e)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      {/* Notes déjà saisies, groupées par (matière, période) — distinct de la liste de planification
          ci-dessus (une composition = un Exam par classe+période ; ici, les évaluations réellement
          notées, une par matière, qui en découlent). */}
      <h3 className="mt-6 text-sm font-semibold text-gray-700">Notes des compositions</h3>
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
          {compositionGroups.length === 0 && (
            <TR><TD colSpan={100} className="py-10 text-center text-gray-400">Aucune note de composition saisie.</TD></TR>
          )}
          {compositionGroups.map((g) => (
            <Fragment key={`compo|${g.subjectId}|${g.periodId}`}>
              <TR>
                <TD colSpan={100} className="bg-gray-50 font-semibold text-gray-700">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {subjectName.get(g.subjectId) ?? `#${g.subjectId}`} · {periodLabel.get(g.periodId) ?? `#${g.periodId}`}
                      <span className="ml-2 font-normal text-gray-400">
                        {g.evals.length} composition{g.evals.length > 1 ? "s" : ""}
                      </span>
                    </span>
                    <Button size="sm" variant="secondary"
                      loading={compositionPdfLoadingKey === `${g.subjectId}|${g.periodId}`}
                      onClick={() => openCompositionPdf(g)}>Relevé (PDF)</Button>
                  </div>
                </TD>
              </TR>
              {g.evals.map((a) => (
                <TR key={a.id}>
                  <TD className="pl-6 font-medium text-gray-900">{a.label}</TD>
                  <TD className="hidden sm:table-cell">{subjectName.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                  <TD className="hidden sm:table-cell">{a.teacherId ? (teacherLabel.get(a.teacherId) ?? `#${a.teacherId}`) : "—"}</TD>
                  <TD><Badge tone="indigo">{ASSESSMENT_TYPE_LABEL[a.type]}</Badge></TD>
                  <TD className="hidden sm:table-cell">/ {a.maxScore}</TD>
                  <TD className="hidden sm:table-cell">{a.coefficient}</TD>
                  <TD className="hidden sm:table-cell">{formatDate(a.date)}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" onClick={() => setGradingFor(a)}>Saisir les notes</Button>
                      <Button size="sm" variant="ghost" loading={gradeSheetLoadingId === a.id} onClick={() => openGradeSheet(a)}>PDF</Button>
                      {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditingAssessment(a)}>Modifier</Button>}
                      {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => handleDeleteAssessment(a)}>Suppr.</Button>}
                    </div>
                  </TD>
                </TR>
              ))}
            </Fragment>
          ))}
        </TBody>
      </Table>

      <Modal open={creating} onClose={() => setCreating(false)} title="Planifier une composition">
        <form onSubmit={handleSubmit(submit)} className="space-y-4">
          <Field>
            <div className="flex items-center justify-between">
              <Label>Matières <span className="text-error-500">*</span></Label>
              <div className="flex gap-2 text-xs">
                <button type="button" className="text-brand-600 hover:underline"
                  onClick={() => setSubjectIds((classSubjectsQuery.data ?? []).map((cm) => String(cm.subjectId)))}>Tout cocher</button>
                <button type="button" className="text-gray-400 hover:underline" onClick={() => setSubjectIds([])}>Tout décocher</button>
              </div>
            </div>
            <p className="text-xs text-gray-400">
              Toutes les matières de la classe sont cochées par défaut — décochez celles à exclure. Le
              coefficient affiché est celui de la matière pour cette classe (c&apos;est lui qui pondère
              la moyenne d&apos;une composition) — modifiable ici directement.
            </p>
            <div className="mt-1.5 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {(classSubjectsQuery.data ?? []).map((cm) => {
                const sid = String(cm.subjectId);
                return (
                  <div key={cm.subjectId} className="flex items-center justify-between gap-2 text-sm">
                    <label className="flex cursor-pointer items-center gap-2">
                      <input type="checkbox" checked={subjectIds.includes(sid)}
                        onChange={() => toggleSubject(sid)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 accent-brand-600" />
                      {subjectName.get(cm.subjectId) ?? `#${cm.subjectId}`}
                    </label>
                    {subjectIds.includes(sid) && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        Coef.
                        <Input type="number" min={0} step={0.5} className="h-7 w-16 px-1.5 text-right"
                          value={coefficients[sid] ?? String(coefFor(sid))}
                          onChange={(e) => setCoefficients((prev) => ({ ...prev, [sid]: e.target.value }))} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {subjectError && <p className="text-xs text-error-600">{subjectError}</p>}
          </Field>
          <Field>
            <Label>Période <span className="text-error-500">*</span></Label>
            <Select value={v.periodId} onChange={(e) => setValue("periodId", e.target.value)}>
              <option value="">— Choisir —</option>
              {(periodsQuery.data ?? []).map((p) => (<option key={p.id} value={p.id}>{p.label}</option>))}
            </Select>
            {errors.periodId && <p className="text-xs text-error-600">{errors.periodId.message}</p>}
          </Field>
          <Field>
            <Label>Type</Label>
            <Select value={v.type} onChange={(e) => setValue("type", e.target.value)}>
              {(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((t) => (<option key={t} value={t}>{EXAM_TYPE_LABEL[t]}</option>))}
            </Select>
          </Field>
          <Field>
            <Label>Libellé <span className="text-error-500">*</span></Label>
            <Input value={v.label} onChange={(e) => setValue("label", e.target.value)} aria-invalid={!!errors.label} />
            {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
          </Field>
          <Field>
            <Label>Date</Label>
            <DatePicker value={v.scheduledDate} onChange={(val) => setValue("scheduledDate", val)} clearable />
            <p className="text-xs text-gray-400">Requise avant de pouvoir saisir les notes.</p>
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Annuler</Button>
            <Button type="submit">Planifier</Button>
          </div>
        </form>
      </Modal>

      <Modal open={!!pickingSubjectFor} onClose={() => setPickingSubjectFor(null)} title={`Saisir les notes — ${pickingSubjectFor?.label ?? ""}`}>
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {(classSubjectsQuery.data ?? []).length === 0 && (
            <p className="py-6 text-center text-sm text-gray-400">Aucune matière affectée à cette classe.</p>
          )}
          {(classSubjectsQuery.data ?? []).map((cm) => (
            <Button key={cm.subjectId} variant="secondary" className="w-full justify-between"
              loading={subjectPickLoading === cm.subjectId}
              onClick={() => pickingSubjectFor && pickSubject(pickingSubjectFor, cm.subjectId)}>
              <span>{subjectName.get(cm.subjectId) ?? `#${cm.subjectId}`}</span>
              {gradedSubjectIds.has(cm.subjectId) && <span className="text-xs text-success-600">✓ déjà saisi</span>}
            </Button>
          ))}
        </div>
      </Modal>
      <Modal open={!!gradingFor} onClose={() => setGradingFor(null)} title={`Notes — ${gradingFor?.label ?? ""} · ${gradingFor ? subjectName.get(gradingFor.subjectId) ?? "" : ""}`}>
        {gradingFor && <GradeGrid assessment={gradingFor} canWrite={canWrite} canEditExisting={canEditExisting} onDone={() => setGradingFor(null)} />}
      </Modal>
      <Modal open={!!editingAssessment} onClose={() => setEditingAssessment(null)} title="Modifier l'évaluation">
        {editingAssessment && (
          <AssessmentForm classId={classId} yearId={yearId} initial={editingAssessment} onCancel={() => setEditingAssessment(null)}
            onCreated={() => { setEditingAssessment(null); notifySuccess("Évaluation modifiée"); assessmentsQuery.refetch(); }} />
        )}
      </Modal>
      <FilePreview url={gradeSheetUrl} title="Fiche de notes" open={gradeSheetUrl != null} onClose={() => setGradeSheetUrl(null)} autoPrint />
      <FilePreview url={compositionPdfUrl} title="Relevé des compositions" open={compositionPdfUrl != null} onClose={() => setCompositionPdfUrl(null)} autoPrint />

      {supervisingFor && (
        <Modal open={!!supervisingFor} onClose={() => setSupervisingFor(null)} title={`Surveillance — ${supervisingFor.label}`}>
          <SupervisionPane exam={supervisingFor} />
        </Modal>
      )}
    </div>
  );
}

// ── Surveillance d'examen (surveillants par salle) ─────────────────────────────
function SupervisionPane({ exam }: { exam: Exam }) {
  const { user } = useAuth();
  const tenantId = user?.tenantId ?? null;
  const q = useQuery(() => listExamSupervisions(exam.id), [exam.id]);
  const roomsQuery = useCachedQuery(tenantId ? `rooms:${tenantId}` : null, listRooms, [tenantId]);
  const teachersQuery = useCachedQuery(tenantId ? `teachers-all:${tenantId}` : null, listTeachers, [tenantId]);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const roomLabel = useMemo(() => new Map(rooms.map((r) => [r.id, r.label])), [rooms]);
  const teacherLabel = useMemo(() => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachers]);
  const roomOptions: SearchableOption[] = useMemo(
    () => rooms.map((r) => ({ value: String(r.id), trigger: r.label, label: r.label, searchText: r.label })),
    [rooms],
  );
  const teacherOptions: SearchableOption[] = useMemo(
    () => teachers.map((t) => {
      const label = `${t.firstName} ${t.lastName}`;
      return { value: String(t.id), trigger: label, label, searchText: label };
    }),
    [teachers],
  );
  const [roomId, setRoomId] = useState<string>("");
  const [teacherId, setTeacherId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!roomId || !teacherId) { notifyError("Choisissez une salle et un enseignant."); return; }
    setSaving(true);
    try {
      await assignExamSupervisor(exam.id, Number(roomId), Number(teacherId));
      notifySuccess("Surveillant affecté");
      setTeacherId("");
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }
  async function remove(id: number) {
    try { await removeExamSupervision(exam.id, id); notifySuccess("Surveillant retiré"); q.refetch(); }
    catch (err) { notifyError(err); }
  }

  const supervisions = q.data ?? [];

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        Affectez les enseignants surveillants par salle. Un même surveillant ne peut pas être sur deux examens le même jour.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field>
          <Label>Salle</Label>
          <SearchableSelect value={roomId} options={roomOptions} onChange={setRoomId} triggerClassName="w-full justify-between px-3" />
        </Field>
        <Field>
          <Label>Surveillant</Label>
          <SearchableSelect value={teacherId} options={teacherOptions} onChange={setTeacherId} triggerClassName="w-full justify-between px-3" />
        </Field>
        <Button onClick={add} loading={saving}>Ajouter</Button>
      </div>

      {q.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : supervisions.length === 0 ? (
        <p className="rounded-lg bg-gray-50 px-3 py-6 text-center text-sm text-gray-400">Aucun surveillant affecté.</p>
      ) : (
        <Table>
          <THead><tr><TH>Salle</TH><TH>Surveillant</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {supervisions.map((s) => (
              <TR key={s.id}>
                <TD>{roomLabel.get(s.roomId) ?? `#${s.roomId}`}</TD>
                <TD>{teacherLabel.get(s.teacherId) ?? `#${s.teacherId}`}</TD>
                <TD className="text-right">
                  <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(s.id)}>Retirer</Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </div>
  );
}

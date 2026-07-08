"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Select as MantineSelect, MultiSelect, NumberInput, Stack, Tabs, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { BookOpen, FileText, GraduationCap, Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import {
  getClassStudents,
  listAcademicYears,
  listClasses,
  listClassSubjects,
  listPeriods,
  listRooms,
  listSubjects,
} from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import {
  assignExamSupervisor,
  completeExam,
  createAssessment,
  createExam,
  deleteAssessment,
  deleteExam,
  listExamSupervisions,
  removeExamSupervision,
  enterBulkGrades,
  generateReportCardsBulk,
  getAssessmentGrades,
  getExamConvocationObjectUrl,
  getSubjectGradeReportPdfObjectUrl,
  getReportCardLines,
  getReportCardPdfObjectUrl,
  listAssessmentsByClass,
  listExamsByClass,
  listReportCards,
  publishReportCard,
  startExam,
  validateAllGrades,
  unlockGrade,
} from "@/lib/api/grading";
import {
  ASSESSMENT_TYPE_LABEL,
  EXAM_STATUS_LABEL,
  EXAM_TYPE_LABEL,
  REPORT_CARD_STATUS_LABEL,
  type Assessment,
  type AssessmentInput,
  type AssessmentType,
  type Exam,
  type ExamType,
  type ReportCard,
} from "@/lib/types/grading";
import type { ClasseMatiere } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { FilePreview } from "@/components/ui/file-preview";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

export default function GradingPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER");
  const canManage = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "SECRETARY");
  // Only admins/directors may modify an already-entered grade; teachers can only enter new ones.
  const canEditExisting = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const yearsQuery = useQuery(listAcademicYears, []);
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const defaultYearId = years.find((y) => y.current)?.id ?? years[0]?.id ?? null;
  const [yearId, setYearId] = useState<number | null>(null);
  const effectiveYearId = yearId ?? defaultYearId;

  const classesQuery = useQuery(
    () => (effectiveYearId ? listClasses(effectiveYearId) : Promise.resolve([])),
    [effectiveYearId],
  );
  const classes = classesQuery.data ?? [];
  // Deep-link from the teacher space: /grading?class=ID preselects the class.
  const searchParams = useSearchParams();
  const [classId, setClassId] = useState<number | null>(() => {
    const c = searchParams.get("class");
    return c ? Number(c) : null;
  });

  return (
    <div className="space-y-6">
      <Reveal y={12}>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Notes, examens & bulletins</h1>
        <p className="text-sm text-slate-500">Évaluations, saisie des notes, examens et bulletins par classe</p>
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Année</label>
          <Select className="max-w-[200px]" value={effectiveYearId ?? ""} onChange={(e) => setYearId(e.target.value ? Number(e.target.value) : null)}>
            {years.map((y) => (<option key={y.id} value={y.id}>{y.label}{y.current ? " (courante)" : ""}</option>))}
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">Classe</label>
          <Select className="max-w-[220px]" value={classId ?? ""} onChange={(e) => setClassId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Choisir —</option>
            {classes.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
          </Select>
        </div>
      </div>

      {!classId ? (
        <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
          Sélectionnez une classe.
        </p>
      ) : (
        <Tabs defaultValue="evaluations" color="teal" variant="pills" radius="md">
          <Tabs.List>
            <Tabs.Tab value="evaluations" leftSection={<BookOpen className="h-4 w-4" />}>Évaluations</Tabs.Tab>
            <Tabs.Tab value="exams" leftSection={<GraduationCap className="h-4 w-4" />}>Examens</Tabs.Tab>
            <Tabs.Tab value="reports" leftSection={<FileText className="h-4 w-4" />}>Bulletins</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="evaluations" pt="lg">
            <EvaluationsTab classId={classId} className={classes.find((c) => c.id === classId)?.label ?? ""}
              yearId={effectiveYearId} canWrite={canWrite} canEditExisting={canEditExisting} />
          </Tabs.Panel>
          <Tabs.Panel value="exams" pt="lg">
            <ExamsTab classId={classId} yearId={effectiveYearId} canManage={canManage} />
          </Tabs.Panel>
          <Tabs.Panel value="reports" pt="lg">
            <ReportCardsTab classId={classId} yearId={effectiveYearId} canManage={canManage} />
          </Tabs.Panel>
        </Tabs>
      )}
    </div>
  );
}

// ── Évaluations tab ──────────────────────────────────────────────────────────
function EvaluationsTab({ classId, className, yearId, canWrite, canEditExisting }: { classId: number; className: string; yearId: number | null; canWrite: boolean; canEditExisting: boolean }) {
  const assessmentsQuery = useQuery(() => listAssessmentsByClass(classId), [classId]);
  const subjectsQuery = useQuery(() => listSubjects(), []);
  const teachersQuery = useQuery(listTeachers, []);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);
  const teacherLabel = useMemo(() => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachersQuery.data]);
  const [creating, setCreating] = useState(false);
  const [gradingFor, setGradingFor] = useState<Assessment | null>(null);
  // Relevé de notes par matière (PDF backend, moyenne calculée selon le paramétrage de l'établissement).
  const periodsQuery = useQuery(() => (yearId ? listPeriods(yearId) : Promise.resolve([])), [yearId]);
  const [releveSubject, setReleveSubject] = useState<string | null>(null);
  const [relevePeriod, setRelevePeriod] = useState<string | null>(null);
  const [releveUrl, setReleveUrl] = useState<string | null>(null);
  const [releveLoading, setReleveLoading] = useState(false);
  async function openReleve() {
    if (!releveSubject || !relevePeriod) return;
    setReleveLoading(true);
    try {
      setReleveUrl(await getSubjectGradeReportPdfObjectUrl(classId, Number(releveSubject), Number(relevePeriod)));
    } catch (err) {
      notifyError(err);
    } finally {
      setReleveLoading(false);
    }
  }

  async function printGradeSheet(a: Assessment) {
    try {
      const [grades, students] = await Promise.all([getAssessmentGrades(a.id), getClassStudents(a.classId)]);
      const gradeOf = new Map(grades.map((g) => [g.studentId, g.value]));
      const scored = students.map((s) => gradeOf.get(s.id)).filter((v): v is string => v != null && v !== "").map(Number);
      const avg = scored.length ? (scored.reduce((x, y) => x + y, 0) / scored.length).toFixed(2) : "—";
      const mn = scored.length ? Math.min(...scored) : "—";
      const mx = scored.length ? Math.max(...scored) : "—";
      const rows = students.map((s, i) => {
        const v = gradeOf.get(s.id);
        return `<tr><td>${i + 1}</td><td>${s.studentNumber ?? ""}</td><td>${s.lastName ?? ""} ${s.firstName ?? ""}</td>`
          + `<td style="text-align:center">${v != null && v !== "" ? v : "—"} / ${a.maxScore}</td></tr>`;
      }).join("");
      const teacher = a.teacherId ? (teacherLabel.get(a.teacherId) ?? "") : "";
      const w = window.open("", "_blank", "width=820,height=900");
      if (!w) { notifyError("Autorisez les pop-ups pour imprimer."); return; }
      w.document.write(
        `<!doctype html><html><head><meta charset="utf-8"><title>Fiche de notes — ${a.label}</title>`
        + `<style>body{font-family:system-ui,Arial,sans-serif;padding:24px;color:#0f172a}`
        + `h1{font-size:20px;text-align:center;margin:0 0 4px}.sub{text-align:center;color:#475569;font-size:13px;margin-bottom:16px}`
        + `table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #cbd5e1;padding:6px 8px}`
        + `th{background:#f1f5f9;text-align:left}.meta{display:flex;flex-wrap:wrap;gap:6px 24px;font-size:13px;margin-bottom:14px}`
        + `.stats{margin-top:12px;display:flex;gap:24px;font-size:13px;font-weight:600}@media print{body{padding:0}}</style></head><body>`
        + `<h1>FICHE DE NOTES</h1><div class="sub">${ASSESSMENT_TYPE_LABEL[a.type]} — ${a.label}</div>`
        + `<div class="meta"><span><strong>Classe :</strong> ${className || "—"}</span>`
        + `<span><strong>Matière :</strong> ${subjectLabel.get(a.subjectId) ?? "—"}</span>`
        + `<span><strong>Enseignant :</strong> ${teacher || "—"}</span>`
        + `<span><strong>Date :</strong> ${a.date ?? "—"}</span>`
        + `<span><strong>Barème :</strong> /${a.maxScore}</span><span><strong>Coef. :</strong> ${a.coefficient}</span></div>`
        + `<table><thead><tr><th>N°</th><th>Matricule</th><th>Nom & prénom</th><th style="text-align:center">Note</th></tr></thead><tbody>${rows}</tbody></table>`
        + `<div class="stats"><span>Moyenne : ${avg}</span><span>Note min : ${mn}</span><span>Note max : ${mx}</span><span>Notés : ${scored.length}/${students.length}</span></div>`
        + `<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`
      );
      w.document.close();
    } catch (err) { notifyError(err); }
  }


  const distinctSubjects = useMemo(
    () => [...new Set((assessmentsQuery.data ?? []).map((a) => a.subjectId))],
    [assessmentsQuery.data]);

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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {distinctSubjects.length > 0 ? (
          <div className="flex flex-wrap items-end gap-2">
            <MantineSelect placeholder="Matière" clearable searchable style={{ minWidth: 200 }} label="Relevé de notes"
              data={distinctSubjects.map((sid) => ({ value: String(sid), label: subjectLabel.get(sid) ?? `#${sid}` }))}
              value={releveSubject} onChange={setReleveSubject} />
            <MantineSelect placeholder="Période" clearable style={{ minWidth: 170 }}
              data={(periodsQuery.data ?? []).map((p) => ({ value: String(p.id), label: p.label }))}
              value={relevePeriod} onChange={setRelevePeriod} />
            <Button variant="secondary" disabled={!releveSubject || !relevePeriod} loading={releveLoading} onClick={openReleve}>
              Relevé (PDF)
            </Button>
          </div>
        ) : <span />}
        {canWrite && (
          <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle évaluation</Button>
        )}
      </div>
      {assessmentsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead>
            <tr><TH>Évaluation</TH><TH>Matière</TH><TH>Enseignant</TH><TH>Type</TH><TH>Barème</TH><TH>Coef.</TH><TH>Date</TH><TH className="text-right">Actions</TH></tr>
          </THead>
          <TBody>
            {(assessmentsQuery.data ?? []).length === 0 && (
              <TR><TD colSpan={8} className="py-10 text-center text-slate-400">Aucune évaluation.</TD></TR>
            )}
            {(assessmentsQuery.data ?? []).map((a) => (
              <TR key={a.id}>
                <TD className="font-medium text-slate-900">{a.label}</TD>
                <TD>{subjectLabel.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                <TD>{a.teacherId ? (teacherLabel.get(a.teacherId) ?? `#${a.teacherId}`) : "—"}</TD>
                <TD><Badge tone="indigo">{ASSESSMENT_TYPE_LABEL[a.type]}</Badge></TD>
                <TD>/ {a.maxScore}</TD>
                <TD>{a.coefficient}</TD>
                <TD>{a.date ?? "—"}</TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" onClick={() => setGradingFor(a)}>Saisir les notes</Button>
                    <Button size="sm" variant="ghost" onClick={() => printGradeSheet(a)}>Fiche de notes</Button>
                    {canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(a)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle évaluation">
        <AssessmentForm classId={classId} yearId={yearId} onCancel={() => setCreating(false)}
          onCreated={() => { setCreating(false); notifySuccess("Évaluation créée"); assessmentsQuery.refetch(); }} />
      </Modal>
      <Modal open={!!gradingFor} onClose={() => setGradingFor(null)} title={`Notes — ${gradingFor?.label ?? ""}`}>
        {gradingFor && <GradeGrid assessment={gradingFor} canWrite={canWrite} canEditExisting={canEditExisting} onDone={() => setGradingFor(null)} />}
      </Modal>
      <FilePreview url={releveUrl} title="Relevé de notes" open={releveUrl != null} onClose={() => setReleveUrl(null)} />
    </div>
  );
}

// ── Examens tab ──────────────────────────────────────────────────────────────
function ExamsTab({ classId, yearId, canManage }: { classId: number; yearId: number | null; canManage: boolean }) {
  const examsQuery = useQuery(() => listExamsByClass(classId), [classId]);
  const periodsQuery = useQuery(() => (yearId ? listPeriods(yearId) : Promise.resolve([])), [yearId]);
  const [creating, setCreating] = useState(false);
  const [supervisingFor, setSupervisingFor] = useState<Exam | null>(null);

  async function changeStatus(e: Exam, action: "start" | "complete") {
    try {
      await (action === "start" ? startExam(e.id) : completeExam(e.id));
      notifySuccess("Statut mis à jour");
      examsQuery.refetch();
    } catch (err) { notifyError(err); }
  }
  async function convocation(e: Exam) {
    try {
      // Flux backend (blob local) — s'ouvre dans un nouvel onglet sans dépendre de Cloudinary.
      window.open(await getExamConvocationObjectUrl(e.id), "_blank");
    } catch (err) { notifyError(err); }
  }
  function handleDelete(e: Exam) {
    confirmAction({
      title: "Supprimer l'examen", message: `Supprimer « ${e.label} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteExam(e.id); notifySuccess("Examen supprimé"); examsQuery.refetch(); } catch (err) { notifyError(err); } },
    });
  }

  const form = useForm({
    mode: "controlled",
    initialValues: { periodId: "", type: "SEMESTER" as ExamType, label: "", scheduledDate: "" },
    validate: { periodId: (v) => (v ? null : "Requis"), label: (v) => (v ? null : "Requis") },
  });
  async function submit(values: typeof form.values) {
    try {
      await createExam({ classId, periodId: Number(values.periodId), type: values.type, label: values.label, scheduledDate: values.scheduledDate || null });
      setCreating(false); form.reset(); notifySuccess("Examen planifié"); examsQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Planifier un examen</Button>
        </div>
      )}
      {examsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Examen</TH><TH>Type</TH><TH>Date</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(examsQuery.data ?? []).length === 0 && (
              <TR><TD colSpan={5} className="py-10 text-center text-slate-400">Aucun examen.</TD></TR>
            )}
            {(examsQuery.data ?? []).map((e) => (
              <TR key={e.id}>
                <TD className="font-medium text-slate-900">{e.label}</TD>
                <TD>{EXAM_TYPE_LABEL[e.type]}</TD>
                <TD>{e.scheduledDate ?? "—"}</TD>
                <TD><Badge tone={e.status === "COMPLETED" ? "green" : e.status === "ONGOING" ? "amber" : "gray"}>{EXAM_STATUS_LABEL[e.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => convocation(e)}>Convocation</Button>
                    {canManage && <Button size="sm" variant="ghost" onClick={() => setSupervisingFor(e)}>Surveillance</Button>}
                    {canManage && e.status === "PLANNED" && <Button size="sm" variant="ghost" onClick={() => changeStatus(e, "start")}>Démarrer</Button>}
                    {canManage && e.status === "ONGOING" && <Button size="sm" variant="ghost" onClick={() => changeStatus(e, "complete")}>Terminer</Button>}
                    {canManage && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(e)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Planifier un examen">
        <form onSubmit={form.onSubmit(submit)}>
          <Stack gap="md">
            <MantineSelect label="Période" withAsterisk
              data={[{ value: "", label: "— Choisir —" }, ...(periodsQuery.data ?? []).map((p) => ({ value: String(p.id), label: p.label }))]}
              {...form.getInputProps("periodId")} />
            <MantineSelect label="Type"
              data={(Object.keys(EXAM_TYPE_LABEL) as ExamType[]).map((t) => ({ value: t, label: EXAM_TYPE_LABEL[t] }))}
              {...form.getInputProps("type")} />
            <TextInput label="Libellé" withAsterisk {...form.getInputProps("label")} />
            <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("scheduledDate")} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setCreating(false)}>Annuler</Button>
              <Button type="submit">Planifier</Button>
            </div>
          </Stack>
        </form>
      </Modal>

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
  const q = useQuery(() => listExamSupervisions(exam.id), [exam.id]);
  const roomsQuery = useQuery(listRooms, []);
  const teachersQuery = useQuery(listTeachers, []);
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);
  const teachers = useMemo(() => teachersQuery.data ?? [], [teachersQuery.data]);
  const roomLabel = useMemo(() => new Map(rooms.map((r) => [r.id, r.label])), [rooms]);
  const teacherLabel = useMemo(() => new Map(teachers.map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachers]);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function add() {
    if (!roomId || !teacherId) { notifyError("Choisissez une salle et un enseignant."); return; }
    setSaving(true);
    try {
      await assignExamSupervisor(exam.id, Number(roomId), Number(teacherId));
      notifySuccess("Surveillant affecté");
      setTeacherId(null);
      q.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }
  async function remove(id: number) {
    try { await removeExamSupervision(exam.id, id); notifySuccess("Surveillant retiré"); q.refetch(); }
    catch (err) { notifyError(err); }
  }

  const supervisions = q.data ?? [];

  return (
    <Stack gap="md">
      <p className="text-xs text-slate-500">
        Affectez les enseignants surveillants par salle. Un même surveillant ne peut pas être sur deux examens le même jour.
      </p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <MantineSelect label="Salle" searchable placeholder="Salle" data={rooms.map((r) => ({ value: String(r.id), label: r.label }))}
          value={roomId} onChange={setRoomId} />
        <MantineSelect label="Surveillant" searchable placeholder="Enseignant" data={teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))}
          value={teacherId} onChange={setTeacherId} />
        <Button onClick={add} loading={saving}>Ajouter</Button>
      </div>

      {q.loading ? (
        <div className="flex justify-center py-6"><Spinner /></div>
      ) : supervisions.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">Aucun surveillant affecté.</p>
      ) : (
        <Table>
          <THead><tr><TH>Salle</TH><TH>Surveillant</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {supervisions.map((s) => (
              <TR key={s.id}>
                <TD>{roomLabel.get(s.roomId) ?? `#${s.roomId}`}</TD>
                <TD>{teacherLabel.get(s.teacherId) ?? `#${s.teacherId}`}</TD>
                <TD className="text-right">
                  <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(s.id)}>Retirer</Button>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}
    </Stack>
  );
}

// ── Bulletins tab ────────────────────────────────────────────────────────────
function ReportCardsTab({ classId, yearId, canManage }: { classId: number; yearId: number | null; canManage: boolean }) {
  const periodsQuery = useQuery(() => (yearId ? listPeriods(yearId) : Promise.resolve([])), [yearId]);
  const periods = periodsQuery.data ?? [];
  const [periodId, setPeriodId] = useState<number | null>(null);
  const effectivePeriod = periodId ?? periods.find((p) => p.closed)?.id ?? periods[0]?.id ?? null;

  const cardsQuery = useQuery(
    () => (effectivePeriod ? listReportCards(classId, effectivePeriod) : Promise.resolve([])),
    [classId, effectivePeriod],
  );
  const [detail, setDetail] = useState<ReportCard | null>(null);
  const [generating, setGenerating] = useState(false);

  async function generate() {
    if (!effectivePeriod) return;
    setGenerating(true);
    try {
      await generateReportCardsBulk(classId, effectivePeriod);
      notifySuccess("Bulletins générés");
      cardsQuery.refetch();
    } catch (err) { notifyError(err); } finally { setGenerating(false); }
  }
  async function publish(c: ReportCard) {
    try { await publishReportCard(c.id); notifySuccess("Bulletin publié"); cardsQuery.refetch(); }
    catch (err) { notifyError(err); }
  }
  async function pdf(c: ReportCard) {
    try {
      window.open(await getReportCardPdfObjectUrl(c.id), "_blank");
    } catch (err) { notifyError(err); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <label className="mb-1 block text-xs text-slate-500">Période</label>
          <Select className="max-w-[240px]" value={effectivePeriod ?? ""} onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : null)}>
            <option value="">— Choisir —</option>
            {periods.map((p) => (<option key={p.id} value={p.id}>{p.label}{p.closed ? " (clôturée)" : ""}</option>))}
          </Select>
        </div>
        {canManage && effectivePeriod && (
          <Button onClick={generate} loading={generating}>Générer les bulletins</Button>
        )}
      </div>

      {cardsQuery.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Élève</TH><TH>Moyenne</TH><TH>Rang</TH><TH>Mention</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(cardsQuery.data ?? []).length === 0 && (
              <TR><TD colSpan={6} className="py-10 text-center text-slate-400">Aucun bulletin pour cette période.</TD></TR>
            )}
            {(cardsQuery.data ?? []).map((c) => (
              <TR key={c.id}>
                <TD className="font-medium text-slate-900">#{c.studentId}</TD>
                <TD>{c.overallAverage ?? "—"}</TD>
                <TD>{c.rank != null ? `${c.rank}/${c.classSize ?? "?"}` : "—"}</TD>
                <TD>{c.honor ?? "—"}</TD>
                <TD><Badge tone={c.status === "PUBLISHED" ? "green" : c.status === "GENERATED" ? "indigo" : "gray"}>{REPORT_CARD_STATUS_LABEL[c.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setDetail(c)}>Détail</Button>
                    <Button size="sm" variant="ghost" onClick={() => pdf(c)}>PDF</Button>
                    {canManage && c.status !== "PUBLISHED" && <Button size="sm" onClick={() => publish(c)}>Publier</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={!!detail} onClose={() => setDetail(null)} title={`Bulletin — élève #${detail?.studentId ?? ""}`}>
        {detail && <ReportCardDetail card={detail} />}
      </Modal>
    </div>
  );
}

function ReportCardDetail({ card }: { card: ReportCard }) {
  const linesQuery = useQuery(() => getReportCardLines(card.id), [card.id]);
  const subjectsQuery = useQuery(() => listSubjects(), []);
  const subjectLabel = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);

  if (linesQuery.loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { l: "Moyenne", v: card.overallAverage ?? "—" },
          { l: "Rang", v: card.rank != null ? `${card.rank}/${card.classSize ?? "?"}` : "—" },
          { l: "Moy. classe", v: card.classAverage ?? "—" },
          { l: "Mention", v: card.honor ?? "—" },
        ].map((i) => (
          <div key={i.l} className="rounded-xl border border-slate-200 p-3 text-center">
            <div className="text-lg font-bold text-slate-900">{i.v}</div>
            <div className="text-xs text-slate-500">{i.l}</div>
          </div>
        ))}
      </div>
      {card.decision && <p className="text-sm text-slate-700">Décision : <strong>{card.decision}</strong></p>}
      <Table>
        <THead><tr><TH>Matière</TH><TH>Moy.</TH><TH>Coef.</TH><TH>Moy. pond.</TH><TH>Rang</TH></tr></THead>
        <TBody>
          {(linesQuery.data ?? []).map((l) => (
            <TR key={l.id}>
              <TD className="font-medium text-slate-900">{subjectLabel.get(l.subjectId) ?? `#${l.subjectId}`}</TD>
              <TD>{l.subjectAverage ?? "—"}</TD>
              <TD>{l.coefficient ?? "—"}</TD>
              <TD>{l.weightedAverage ?? "—"}</TD>
              <TD>{l.subjectRank ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

// ── Assessment create form ───────────────────────────────────────────────────
function AssessmentForm({ classId, yearId, onCancel, onCreated }: {
  classId: number; yearId: number | null; onCancel: () => void; onCreated: () => void;
}) {
  const subjectsQuery = useQuery(() => listClassSubjects(classId), [classId]);
  const allSubjects = useQuery(() => listSubjects(), []);
  const periodsQuery = useQuery(() => (yearId ? listPeriods(yearId) : Promise.resolve([])), [yearId]);
  const teachersQuery = useQuery(listTeachers, []);
  const [loading, setLoading] = useState(false);

  const subjectName = useMemo(() => new Map((allSubjects.data ?? []).map((s) => [s.id, s.label])), [allSubjects.data]);
  const teacherName = useMemo(() => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])), [teachersQuery.data]);
  const classSubjects: ClasseMatiere[] = subjectsQuery.data ?? [];

  const form = useForm({
    mode: "controlled",
    initialValues: { subjectIds: [] as string[], periodId: "", type: "HOMEWORK" as AssessmentType, label: "", date: "", coefficient: 1, maxScore: 20 },
    validate: {
      subjectIds: (v) => (v.length ? null : "Choisissez au moins une matière"),
      periodId: (v) => (v ? null : "Requis"),
      label: (v) => (v ? null : "Requis"),
    },
  });

  // Coefficient d'une matière POUR CETTE CLASSE (ClasseMatiere), sinon coef par défaut de la matière.
  function coefFor(sid: string): number {
    const cm = classSubjects.find((c) => String(c.subjectId) === sid);
    if (cm?.coefficient != null && !Number.isNaN(Number(cm.coefficient))) return Number(cm.coefficient);
    const subj = (allSubjects.data ?? []).find((s) => String(s.id) === sid);
    if (subj?.coefficient != null && !Number.isNaN(Number(subj.coefficient))) return Number(subj.coefficient);
    return Number(form.values.coefficient) || 1;
  }

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const multi = values.subjectIds.length > 1;
      for (const sid of values.subjectIds) {
        const cm = classSubjects.find((c) => String(c.subjectId) === sid);
        const input: AssessmentInput = {
          classId, subjectId: Number(sid), teacherId: cm?.teacherId ?? null,
          periodId: Number(values.periodId), type: values.type, label: values.label,
          date: values.date || null,
          coefficient: multi ? coefFor(sid) : Number(values.coefficient),
          maxScore: Number(values.maxScore),
        };
        await createAssessment(input);
      }
      onCreated();
    } catch (err) {
      notifyError(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <MultiSelect label="Matière(s)" withAsterisk searchable
          placeholder="Une ou plusieurs matières"
          description="Sélectionnez plusieurs matières pour créer l'évaluation d'un coup (ex. composition)."
          data={classSubjects.map((cm) => ({ value: String(cm.subjectId), label: subjectName.get(cm.subjectId) ?? `#${cm.subjectId}` }))}
          {...form.getInputProps("subjectIds")}
          onChange={(vals) => {
            form.setFieldValue("subjectIds", vals);
            // Une seule matière → on pré-remplit le coefficient (éditable).
            if (vals.length === 1) {
              const c = coefFor(vals[0]);
              if (c > 0) form.setFieldValue("coefficient", c);
            }
          }} />
        {form.values.subjectIds.length > 0 && (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <p className="mb-1 text-xs font-medium text-slate-500">Enseignant(s) — affecté(s) à cette classe</p>
            {form.values.subjectIds.map((sid) => {
              const cm = classSubjects.find((c) => String(c.subjectId) === sid);
              return (
                <div key={sid} className="flex justify-between py-0.5">
                  <span className="text-slate-700">{subjectName.get(Number(sid)) ?? `#${sid}`}</span>
                  <span className={cm?.teacherId ? "text-slate-600" : "text-amber-600"}>
                    {cm?.teacherId ? (teacherName.get(cm.teacherId) ?? `#${cm.teacherId}`) : "aucun enseignant affecté"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {!periodsQuery.loading && (periodsQuery.data ?? []).length === 0 && (
          <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Aucune période pour cette année. Créez d&apos;abord des <strong>trimestres / semestres</strong> dans « Années scolaires », puis revenez ajouter l&apos;évaluation.
          </div>
        )}
        <MantineSelect label="Période" withAsterisk
          data={[{ value: "", label: "— Choisir —" }, ...(periodsQuery.data ?? []).map((p) => ({ value: String(p.id), label: `${p.label}${p.closed ? " (clôturée)" : ""}`, disabled: p.closed }))]}
          {...form.getInputProps("periodId")} />
        <MantineSelect label="Type"
          data={(Object.keys(ASSESSMENT_TYPE_LABEL) as AssessmentType[]).map((t) => ({ value: t, label: ASSESSMENT_TYPE_LABEL[t] }))}
          {...form.getInputProps("type")} />
        <TextInput label="Libellé" withAsterisk {...form.getInputProps("label")} />
        <DatePickerInput label="Date" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("date")} />
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="Note sur" min={1} {...form.getInputProps("maxScore")} />
          {form.values.subjectIds.length > 1 ? (
            <div className="flex items-end pb-1 text-xs text-slate-500">Coefficient : automatique par matière (selon la classe).</div>
          ) : (
            <NumberInput label="Coefficient" min={0} step={0.5} {...form.getInputProps("coefficient")} />
          )}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>Créer</Button>
        </div>
      </Stack>
    </form>
  );
}

// ── Bulk grade grid ──────────────────────────────────────────────────────────
function GradeGrid({ assessment, canWrite, canEditExisting, onDone }: { assessment: Assessment; canWrite: boolean; canEditExisting: boolean; onDone: () => void }) {
  const studentsQuery = useQuery(() => getClassStudents(assessment.classId), [assessment.classId]);
  const gradesQuery = useQuery(() => getAssessmentGrades(assessment.id), [assessment.id]);
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);
  const max = Number(assessment.maxScore);

  const existing = useMemo(() => new Map((gradesQuery.data ?? []).map((g) => [g.studentId, g])), [gradesQuery.data]);
  const locked = (gradesQuery.data ?? []).some((g) => g.validated);

  function valueOf(studentId: number): string { return values[studentId] ?? existing.get(studentId)?.value ?? ""; }
  function invalid(v: string): boolean { if (v === "") return false; const n = Number(v); return Number.isNaN(n) || n < 0 || n > max; }

  async function save() {
    setSaving(true);
    try {
      const entries = (studentsQuery.data ?? [])
        .map((s) => ({ studentId: s.id, raw: valueOf(s.id) }))
        .filter((e) => e.raw !== "" && !invalid(e.raw))
        .map((e) => ({ studentId: e.studentId, value: Number(e.raw) }));
      await enterBulkGrades(assessment.id, entries);
      notifySuccess("Notes enregistrées");
      gradesQuery.refetch();
    } catch (err) { notifyError(err); } finally { setSaving(false); }
  }
  async function validate() {
    try { await validateAllGrades(assessment.id); notifySuccess("Notes validées (verrouillées)"); onDone(); }
    catch (err) { notifyError(err); }
  }
  async function unlockAll() {
    const validated = (gradesQuery.data ?? []).filter((g) => g.validated);
    try {
      await Promise.all(validated.map((g) => unlockGrade(g.id)));
      notifySuccess("Notes déverrouillées — correction possible");
      gradesQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  if (studentsQuery.loading || gradesQuery.loading) return <div className="flex justify-center py-8"><Spinner /></div>;

  return (
    <div className="space-y-4">
      {locked && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">
          <span>Notes validées et verrouillées.</span>
          {canEditExisting && <Button size="sm" variant="outline" onClick={unlockAll}>Déverrouiller</Button>}
        </div>
      )}
      {!locked && !canEditExisting && (
        <p className="rounded-xl bg-slate-50 px-4 py-2 text-xs text-slate-500">Vous pouvez saisir les notes manquantes. Une note déjà saisie n&apos;est modifiable que par la direction.</p>
      )}
      <div className="max-h-[55vh] overflow-y-auto">
        <Table>
          <THead><tr><TH>Élève</TH><TH>Note / {max}</TH></tr></THead>
          <TBody>
            {(studentsQuery.data ?? []).map((s) => {
              const v = valueOf(s.id);
              const bad = invalid(v);
              // A grade already entered for this student is read-only unless the user may edit existing grades.
              const alreadyEntered = existing.get(s.id)?.value != null && existing.get(s.id)?.value !== "";
              const readOnly = locked || !canWrite || (alreadyEntered && !canEditExisting);
              return (
                <TR key={s.id}>
                  <TD className="font-medium text-slate-900">{s.firstName} {s.lastName}</TD>
                  <TD>
                    <input type="number" min={0} max={max} disabled={readOnly} value={v}
                      onChange={(e) => setValues((p) => ({ ...p, [s.id]: e.target.value }))}
                      className={`h-9 w-24 rounded-lg border px-2 text-sm outline-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${bad ? "border-red-400 bg-red-50 text-red-700" : "border-slate-200 focus:border-brand-400"}`} />
                    {alreadyEntered && !canEditExisting && !locked && <span className="ml-2 text-[10px] text-slate-400">saisie verrouillée</span>}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </div>
      {canWrite && !locked && (
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button variant="secondary" onClick={save} loading={saving}>Enregistrer</Button>
          <Button onClick={validate}>Valider & verrouiller</Button>
        </div>
      )}
    </div>
  );
}

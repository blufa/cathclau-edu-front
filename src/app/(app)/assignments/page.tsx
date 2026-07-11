"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getClassStudents, listAcademicYears, listClasses, listClassSubjects, listSubjects } from "@/lib/api/academics";
import {
  closeAssignment,
  createAssignment,
  updateAssignment,
  deleteAssignment,
  gradeSubmission,
  listAssignments,
  listSubmissions,
  reopenAssignment,
} from "@/lib/api/assignments";
import {
  ASSIGNMENT_STATUS_LABEL,
  SUBMISSION_STATUS_LABEL,
  type Assignment,
  type AssignmentSubmission,
} from "@/lib/types/assignment";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE = { OPEN: "green", CLOSED: "gray" } as const;
const SUB_TONE = { SUBMITTED: "indigo", LATE: "amber", GRADED: "green" } as const;

export default function AssignmentsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER");

  const yearsQuery = useQuery(listAcademicYears, []);
  const cy = (yearsQuery.data ?? []).find((y) => y.current) ?? (yearsQuery.data ?? [])[0];
  const classesQuery = useQuery(() => (cy ? listClasses(cy.id) : Promise.resolve([])), [cy?.id]);
  const classes = classesQuery.data ?? [];
  const [classId, setClassId] = useState<number | null>(null);
  const effectiveClassId = classId ?? classes[0]?.id ?? null;

  const subjectsQuery = useQuery(listSubjects, []);
  const subjectName = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);

  const q = useQuery(
    () => (effectiveClassId ? listAssignments({ classId: effectiveClassId }) : Promise.resolve([])),
    [effectiveClassId],
  );

  const [creating, setCreating] = useState(false);
  const [submissionsFor, setSubmissionsFor] = useState<Assignment | null>(null);
  const [editing, setEditing] = useState<Assignment | null>(null);

  function toggleStatus(a: Assignment) {
    const action = a.status === "OPEN" ? closeAssignment(a.id) : reopenAssignment(a.id);
    action.then(() => { notifySuccess("Statut mis à jour"); q.refetch(); }).catch(notifyError);
  }
  function remove(a: Assignment) {
    confirmAction({
      title: "Supprimer le devoir", message: `Supprimer « ${a.title} » et ses rendus ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteAssignment(a.id); notifySuccess("Devoir supprimé"); q.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Devoirs</h1>
          <p className="text-sm text-slate-500">Devoirs à rendre par classe et suivi des rendus</p>
        </div>
        {canWrite && effectiveClassId && (
          <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouveau devoir</Button>
        )}
      </Reveal>

      <Select
        className="max-w-[260px]"
        label="Classe"
        searchable
        data={classes.map((c) => ({ value: String(c.id), label: c.label }))}
        value={effectiveClassId != null ? String(effectiveClassId) : null}
        onChange={(value) => setClassId(value ? Number(value) : null)}
      />

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Devoir</TH><TH>Matière</TH><TH>Échéance</TH><TH>Barème</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {(q.data ?? []).length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-slate-400">Aucun devoir pour cette classe.</TD></TR>}
            {(q.data ?? []).map((a) => (
              <TR key={a.id}>
                <TD className="font-medium text-slate-900">{a.title}</TD>
                <TD>{subjectName.get(a.subjectId) ?? `#${a.subjectId}`}</TD>
                <TD>{a.dueDate ?? "—"}</TD>
                <TD>{a.maxScore != null ? `/${a.maxScore}` : "—"}</TD>
                <TD><Badge tone={STATUS_TONE[a.status]}>{ASSIGNMENT_STATUS_LABEL[a.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setSubmissionsFor(a)}>Rendus</Button>
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditing(a)}>Modifier</Button>}
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => toggleStatus(a)}>{a.status === "OPEN" ? "Clôturer" : "Rouvrir"}</Button>}
                    {canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(a)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating || !!editing} onClose={() => { setCreating(false); setEditing(null); }} title={editing ? "Modifier le devoir" : "Nouveau devoir"}>
        {(editing?.classId ?? effectiveClassId) && (
          <AssignmentForm classId={editing?.classId ?? effectiveClassId!} initial={editing} subjectName={subjectName}
            onCancel={() => { setCreating(false); setEditing(null); }}
            onCreated={() => { setCreating(false); setEditing(null); notifySuccess(editing ? "Devoir mis à jour" : "Devoir créé"); q.refetch(); }} />
        )}
      </Modal>

      <Modal open={!!submissionsFor} onClose={() => setSubmissionsFor(null)} title={submissionsFor ? `Rendus — ${submissionsFor.title}` : ""}>
        {submissionsFor && <SubmissionsPanel assignment={submissionsFor} canWrite={canWrite} />}
      </Modal>
    </div>
  );
}

function AssignmentForm({ classId, initial, subjectName, onCancel, onCreated }: {
  classId: number; initial?: Assignment | null; subjectName: Map<number, string>; onCancel: () => void; onCreated: () => void;
}) {
  const classSubjectsQuery = useQuery(() => listClassSubjects(classId), [classId]);
  const [loading, setLoading] = useState(false);
  const form = useForm({
    mode: "controlled",
    initialValues: {
      subjectId: initial?.subjectId ? String(initial.subjectId) : "",
      title: initial?.title ?? "",
      instructions: initial?.instructions ?? "",
      dueDate: initial?.dueDate ?? "",
      maxScore: (initial?.maxScore != null ? Number(initial.maxScore) : 20) as number | string,
    },
    validate: { subjectId: (v) => (v ? null : "Requis"), title: (v) => (v ? null : "Requis") },
  });

  async function submit(values: typeof form.values) {
    setLoading(true);
    try {
      const payload = {
        classId,
        subjectId: Number(values.subjectId),
        title: values.title,
        instructions: values.instructions || null,
        dueDate: values.dueDate || null,
        maxScore: values.maxScore === "" ? null : Number(values.maxScore),
      };
      if (initial) await updateAssignment(initial.id, payload);
      else await createAssignment(payload);
      onCreated();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <Select label="Matière" withAsterisk searchable
          data={[{ value: "", label: "— Choisir —" }, ...(classSubjectsQuery.data ?? []).map((cm) => ({ value: String(cm.subjectId), label: subjectName.get(cm.subjectId) ?? `#${cm.subjectId}` }))]}
          {...form.getInputProps("subjectId")} />
        <TextInput label="Titre" withAsterisk {...form.getInputProps("title")} />
        <Textarea label="Consignes" autosize minRows={3} {...form.getInputProps("instructions")} />
        <div className="grid grid-cols-2 gap-3">
          <DatePickerInput label="Échéance" valueFormat="DD/MM/YYYY" clearable {...form.getInputProps("dueDate")} />
          <NumberInput label="Barème (note sur)" min={1} {...form.getInputProps("maxScore")} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
          <Button type="submit" loading={loading}>{initial ? "Enregistrer" : "Créer"}</Button>
        </div>
      </Stack>
    </form>
  );
}

function SubmissionsPanel({ assignment, canWrite }: { assignment: Assignment; canWrite: boolean }) {
  const studentsQuery = useQuery(() => getClassStudents(assignment.classId), [assignment.classId]);
  const subsQuery = useQuery(() => listSubmissions(assignment.id), [assignment.id]);
  const subByStudent = useMemo(
    () => new Map((subsQuery.data ?? []).map((s) => [s.studentId, s])),
    [subsQuery.data],
  );

  async function grade(sub: AssignmentSubmission, value: string, feedback: string) {
    try {
      await gradeSubmission(sub.id, { grade: value === "" ? null : Number(value), feedback: feedback || null });
      notifySuccess("Note enregistrée");
      subsQuery.refetch();
    } catch (err) { notifyError(err); }
  }

  if (studentsQuery.loading || subsQuery.loading) return <div className="flex justify-center py-8"><Spinner /></div>;
  const students = studentsQuery.data ?? [];

  return (
    <Table>
      <THead><tr><TH>Élève</TH><TH>État</TH><TH>Note</TH>{canWrite && <TH className="text-right">Noter</TH>}</tr></THead>
      <TBody>
        {students.length === 0 && <TR><TD colSpan={canWrite ? 4 : 3} className="py-8 text-center text-slate-400">Aucun élève inscrit.</TD></TR>}
        {students.map((st) => {
          const sub = subByStudent.get(st.id);
          return (
            <TR key={st.id}>
              <TD className="font-medium text-slate-900">{st.firstName} {st.lastName}</TD>
              <TD>{sub ? <Badge tone={SUB_TONE[sub.status]}>{SUBMISSION_STATUS_LABEL[sub.status]}</Badge> : <span className="text-slate-400">Non remis</span>}</TD>
              <TD>{sub?.grade != null ? `${sub.grade}${assignment.maxScore != null ? `/${assignment.maxScore}` : ""}` : "—"}</TD>
              {canWrite && (
                <TD className="text-right">
                  {sub ? <GradeInline sub={sub} onGrade={grade} /> : <span className="text-xs text-slate-300">—</span>}
                </TD>
              )}
            </TR>
          );
        })}
      </TBody>
    </Table>
  );
}

function GradeInline({ sub, onGrade }: { sub: AssignmentSubmission; onGrade: (s: AssignmentSubmission, v: string, f: string) => void }) {
  const [val, setVal] = useState(sub.grade != null ? String(sub.grade) : "");
  const [fb, setFb] = useState(sub.feedback ?? "");
  return (
    <div className="flex items-center justify-end gap-1">
      <input className="w-14 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Note" value={val} onChange={(e) => setVal(e.target.value)} />
      <input className="w-32 rounded border border-slate-200 px-2 py-1 text-sm" placeholder="Appréciation" value={fb} onChange={(e) => setFb(e.target.value)} />
      <Button size="sm" onClick={() => onGrade(sub, val, fb)}>OK</Button>
    </div>
  );
}

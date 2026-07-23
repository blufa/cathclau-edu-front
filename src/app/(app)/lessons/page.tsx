"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses, listClassSubjects, listSubjects } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { createLesson, deleteLesson, listLessons, markLessonDone, markLessonPlanned, updateLesson } from "@/lib/api/lessons";
import { LESSON_STATUS_LABEL, type LessonEntry, type LessonStatus } from "@/lib/types/lesson";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE = { PLANNED: "amber", DONE: "green" } as const;

export default function LessonsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER");
  // Valider qu'une séance a été réalisée relève de l'administration — l'enseignant saisit la séance
  // (et peut corriger sa saisie) mais ne valide pas lui-même sa réalisation.
  const isAdmin = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR");

  const yearsQuery = useQuery(listAcademicYears, []);
  const cy = (yearsQuery.data ?? []).find((y) => y.current) ?? (yearsQuery.data ?? [])[0];
  const classesQuery = useQuery(() => (cy ? listClasses(cy.id) : Promise.resolve([])), [cy?.id]);
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data]);
  const [classId, setClassId] = useState<number | null>(null);
  const effectiveClassId = classId ?? classes[0]?.id ?? null;
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );

  const subjectsQuery = useQuery(listSubjects, []);
  const subjectName = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);
  const subjectFilterOptions: SearchableOption[] = useMemo(
    () => [
      { value: "", trigger: "Toutes", label: "Toutes", searchText: "toutes" },
      ...(subjectsQuery.data ?? []).map((s) => ({ value: String(s.id), trigger: s.label, label: s.label, searchText: s.label })),
    ],
    [subjectsQuery.data],
  );

  const q = useQuery(
    () => (effectiveClassId ? listLessons({ classId: effectiveClassId, subjectId: subjectId ?? undefined }) : Promise.resolve([])),
    [effectiveClassId, subjectId],
  );
  const lessons = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => (b.lessonDate ?? "").localeCompare(a.lessonDate ?? "")),
    [q.data],
  );

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<LessonEntry | null>(null);

  function act(p: Promise<unknown>) { p.then(() => { notifySuccess("Mis à jour"); q.refetch(); }).catch(notifyError); }
  function remove(l: LessonEntry) {
    confirmAction({
      title: "Supprimer la séance", message: `Supprimer « ${l.title} » ?`, confirmLabel: "Supprimer", danger: true,
      onConfirm: async () => { try { await deleteLesson(l.id); notifySuccess("Supprimée"); q.refetch(); } catch (e) { notifyError(e); } },
    });
  }

  return (
    <div className="space-y-6">
      <Reveal y={12} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">Cahier de textes</h1>
          <p className="text-sm text-gray-500">Séances, contenu des cours et devoirs donnés — suivi de progression</p>
        </div>
        {canWrite && effectiveClassId && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle séance</Button>}
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <Field>
          <Label>Classe</Label>
          <SearchableSelect value={effectiveClassId != null ? String(effectiveClassId) : ""} options={classOptions}
            onChange={(v) => { setClassId(v ? Number(v) : null); setSubjectId(null); }} triggerClassName="w-full max-w-[240px] justify-between px-3" />
        </Field>
        <Field>
          <Label>Matière</Label>
          <SearchableSelect value={subjectId != null ? String(subjectId) : ""} options={subjectFilterOptions}
            onChange={(v) => setSubjectId(v ? Number(v) : null)} triggerClassName="w-full max-w-[240px] justify-between px-3" />
        </Field>
      </div>

      {effectiveClassId && lessons.length > 0 && (() => {
        const done = lessons.filter((l) => l.status === "DONE").length;
        const rate = Math.round((done / lessons.length) * 100);
        return (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${rate >= 70 ? "bg-success-50 text-success-800" : "bg-warning-50 text-warning-800"}`}>
            <span className="font-semibold">Taux de réalisation des cours : {rate}%</span>
            <span className="text-gray-500">{done}/{lessons.length} séances réalisées</span>
          </div>
        );
      })()}

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Date</TH><TH>Matière</TH><TH>Thème</TH><TH>Devoirs</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {lessons.length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-gray-400">Aucune séance.</TD></TR>}
            {lessons.map((l) => (
              <TR key={l.id}>
                <TD>{l.lessonDate}</TD>
                <TD>{subjectName.get(l.subjectId) ?? `#${l.subjectId}`}</TD>
                <TD className="max-w-[220px]">
                  <p className="font-medium text-gray-900">{l.title}</p>
                  {l.content && <p className="truncate text-xs text-gray-500" title={l.content}>{l.content}</p>}
                </TD>
                <TD className="max-w-[160px] truncate text-sm text-gray-600" title={l.homework ?? ""}>{l.homework ?? "—"}</TD>
                <TD><Badge tone={STATUS_TONE[l.status]}>{LESSON_STATUS_LABEL[l.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Modifier</Button>}
                    {isAdmin && <Button size="sm" variant="ghost" onClick={() => act(l.status === "PLANNED" ? markLessonDone(l.id) : markLessonPlanned(l.id))}>{l.status === "PLANNED" ? "Réalisée" : "Replanifier"}</Button>}
                    {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(l)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle séance">
        {effectiveClassId && (
          <LessonForm classId={effectiveClassId} subjectName={subjectName} canSetStatus={isAdmin} onCancel={() => setCreating(false)}
            onCreated={() => { setCreating(false); notifySuccess("Séance créée"); q.refetch(); }} />
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la séance">
        {editing && (
          <EditLessonForm lesson={editing} subjectName={subjectName} canSetStatus={isAdmin} onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); notifySuccess("Séance mise à jour"); q.refetch(); }} />
        )}
      </Modal>
    </div>
  );
}

type LessonRow = { subjectId: string; title: string; content: string; homework: string; durationMinutes: string };
const EMPTY_LESSON_ROW: LessonRow = { subjectId: "", title: "", content: "", homework: "", durationMinutes: "60" };

function LessonForm({ classId, subjectName, canSetStatus, onCancel, onCreated }: {
  classId: number; subjectName: Map<number, string>; canSetStatus: boolean; onCancel: () => void; onCreated: () => void;
}) {
  const classSubjectsQuery = useQuery(() => listClassSubjects(classId), [classId]);
  const teachersQuery = useQuery(listTeachers, []);
  const classSubjects = useMemo(() => classSubjectsQuery.data ?? [], [classSubjectsQuery.data]);
  const teacherName = useMemo(
    () => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachersQuery.data]);

  const [loading, setLoading] = useState(false);
  const [lessonDate, setLessonDate] = useState("");
  // Un enseignant saisit toujours une séance "Planifiée" : seule l'administration valide la réalisation.
  const [status, setStatus] = useState<LessonStatus>(canSetStatus ? "DONE" : "PLANNED");
  const [rows, setRows] = useState<LessonRow[]>([EMPTY_LESSON_ROW]);

  const subjectOptions: SearchableOption[] = useMemo(
    () => classSubjects.map((cm) => {
      const label = subjectName.get(cm.subjectId) ?? `#${cm.subjectId}`;
      return { value: String(cm.subjectId), trigger: label, label, searchText: label };
    }),
    [classSubjects, subjectName],
  );

  function updateRow(idx: number, key: keyof LessonRow, value: string) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }
  function addRow() { setRows((prev) => [...prev, EMPTY_LESSON_ROW]); }
  function removeRow(idx: number) { setRows((prev) => prev.filter((_, i) => i !== idx)); }
  function teacherFor(sid: string): string | null {
    const cm = classSubjects.find((c) => String(c.subjectId) === sid);
    return cm?.teacherId ? (teacherName.get(cm.teacherId) ?? `#${cm.teacherId}`) : null;
  }

  async function submit() {
    const valid = rows.filter((r) => r.subjectId && r.title.trim());
    if (valid.length === 0) { notifyError("Ajoutez au moins une séance (matière + thème)."); return; }
    setLoading(true);
    try {
      for (const r of valid) {
        await createLesson({
          classId,
          subjectId: Number(r.subjectId),
          lessonDate: lessonDate || null,
          title: r.title,
          content: r.content || null,
          homework: r.homework || null,
          durationMinutes: r.durationMinutes === "" ? null : Number(r.durationMinutes),
          status,
        });
      }
      onCreated();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field><Label>Date (commune)</Label><DatePicker value={lessonDate} clearable onChange={setLessonDate} /></Field>
        {canSetStatus && (
          <Field>
            <Label>Statut (commun)</Label>
            <div className="flex gap-2">
              {(["DONE", "PLANNED"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${status === s ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                  {LESSON_STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </Field>
        )}
      </div>

      {rows.map((row, idx) => (
        <div key={idx} className="space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="grid grid-cols-[1fr_100px_auto] items-end gap-2">
            <Field>
              <Label>Matière <span className="text-error-500">*</span></Label>
              <SearchableSelect value={row.subjectId} options={subjectOptions} onChange={(v) => updateRow(idx, "subjectId", v)} triggerClassName="w-full justify-between px-3" />
            </Field>
            <Field>
              <Label>Durée (min)</Label>
              <Input type="number" min={0} value={row.durationMinutes} onChange={(e) => updateRow(idx, "durationMinutes", e.target.value)} />
            </Field>
            <Button variant="ghost" className="text-error-600" disabled={rows.length === 1} onClick={() => removeRow(idx)}>✕</Button>
          </div>
          {row.subjectId && (
            <p className="text-xs text-gray-500">
              Enseignant : <span className={teacherFor(row.subjectId) ? "text-gray-700" : "text-warning-600"}>
                {teacherFor(row.subjectId) ?? "aucun enseignant affecté"}
              </span>
            </p>
          )}
          <Field>
            <Label>Thème de la séance <span className="text-error-500">*</span></Label>
            <Input value={row.title} onChange={(e) => updateRow(idx, "title", e.target.value)} />
          </Field>
          <Field>
            <Label>Contenu</Label>
            <Textarea rows={2} value={row.content} onChange={(e) => updateRow(idx, "content", e.target.value)} />
          </Field>
          <Field>
            <Label>Devoirs donnés</Label>
            <Textarea rows={1} value={row.homework} onChange={(e) => updateRow(idx, "homework", e.target.value)} />
          </Field>
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={addRow}>+ Ajouter une séance</Button>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Créer {rows.length > 1 ? `(${rows.length})` : ""}</Button>
      </div>
    </div>
  );
}

/** Édition d'une séance existante — l'enseignant corrige sa saisie (thème, contenu, devoirs) ;
 * seule l'administration (`canSetStatus`) peut aussi y valider la réalisation. */
function EditLessonForm({ lesson, subjectName, canSetStatus, onCancel, onSaved }: {
  lesson: LessonEntry; subjectName: Map<number, string>; canSetStatus: boolean; onCancel: () => void; onSaved: () => void;
}) {
  const classSubjectsQuery = useQuery(() => listClassSubjects(lesson.classId), [lesson.classId]);
  const classSubjects = useMemo(() => classSubjectsQuery.data ?? [], [classSubjectsQuery.data]);
  const subjectOptions: SearchableOption[] = useMemo(
    () => classSubjects.map((cm) => {
      const label = subjectName.get(cm.subjectId) ?? `#${cm.subjectId}`;
      return { value: String(cm.subjectId), trigger: label, label, searchText: label };
    }),
    [classSubjects, subjectName],
  );

  const [loading, setLoading] = useState(false);
  const [subjectId, setSubjectId] = useState(String(lesson.subjectId));
  const [lessonDate, setLessonDate] = useState(lesson.lessonDate ?? "");
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content ?? "");
  const [homework, setHomework] = useState(lesson.homework ?? "");
  const [durationMinutes, setDurationMinutes] = useState(lesson.durationMinutes != null ? String(lesson.durationMinutes) : "");
  const [status, setStatus] = useState<LessonStatus>(lesson.status);

  async function submit() {
    if (!subjectId || !title.trim()) { notifyError("Matière et thème requis."); return; }
    setLoading(true);
    try {
      await updateLesson(lesson.id, {
        classId: lesson.classId,
        subjectId: Number(subjectId),
        lessonDate: lessonDate || null,
        title,
        content: content || null,
        homework: homework || null,
        durationMinutes: durationMinutes === "" ? null : Number(durationMinutes),
        status: canSetStatus ? status : lesson.status,
      });
      onSaved();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Matière <span className="text-error-500">*</span></Label>
          <SearchableSelect value={subjectId} options={subjectOptions} onChange={setSubjectId} triggerClassName="w-full justify-between px-3" />
        </Field>
        <Field><Label>Date</Label><DatePicker value={lessonDate} clearable onChange={setLessonDate} /></Field>
      </div>
      <Field>
        <Label>Thème de la séance <span className="text-error-500">*</span></Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      <Field><Label>Contenu</Label><Textarea rows={2} value={content} onChange={(e) => setContent(e.target.value)} /></Field>
      <Field><Label>Devoirs donnés</Label><Textarea rows={2} value={homework} onChange={(e) => setHomework(e.target.value)} /></Field>
      <Field>
        <Label>Durée (min)</Label>
        <Input type="number" min={0} className="w-32" value={durationMinutes} onChange={(e) => setDurationMinutes(e.target.value)} />
      </Field>
      {canSetStatus && (
        <Field>
          <Label>Statut</Label>
          <div className="flex gap-2">
            {(["DONE", "PLANNED"] as const).map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${status === s ? "bg-brand-600 text-white" : "border border-gray-200 text-gray-500 hover:bg-gray-50"}`}>
                {LESSON_STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </Field>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Enregistrer</Button>
      </div>
    </div>
  );
}

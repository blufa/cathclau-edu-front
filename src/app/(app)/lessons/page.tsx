"use client";

import { useMemo, useState } from "react";
import { NumberInput, Select, Stack, Textarea, TextInput } from "@mantine/core";
import { DatePickerInput } from "@mantine/dates";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { listAcademicYears, listClasses, listClassSubjects, listSubjects } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { createLesson, deleteLesson, listLessons, markLessonDone, markLessonPlanned } from "@/lib/api/lessons";
import { LESSON_STATUS_LABEL, type LessonEntry } from "@/lib/types/lesson";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const STATUS_TONE = { PLANNED: "amber", DONE: "green" } as const;

export default function LessonsPage() {
  const { user } = useAuth();
  const canWrite = hasRole(user, "SCHOOL_ADMIN", "DIRECTOR", "TEACHER");

  const yearsQuery = useQuery(listAcademicYears, []);
  const cy = (yearsQuery.data ?? []).find((y) => y.current) ?? (yearsQuery.data ?? [])[0];
  const classesQuery = useQuery(() => (cy ? listClasses(cy.id) : Promise.resolve([])), [cy?.id]);
  const classes = classesQuery.data ?? [];
  const [classId, setClassId] = useState<number | null>(null);
  const effectiveClassId = classId ?? classes[0]?.id ?? null;
  const [subjectId, setSubjectId] = useState<number | null>(null);

  const subjectsQuery = useQuery(listSubjects, []);
  const subjectName = useMemo(() => new Map((subjectsQuery.data ?? []).map((s) => [s.id, s.label])), [subjectsQuery.data]);

  const q = useQuery(
    () => (effectiveClassId ? listLessons({ classId: effectiveClassId, subjectId: subjectId ?? undefined }) : Promise.resolve([])),
    [effectiveClassId, subjectId],
  );
  const lessons = useMemo(
    () => [...(q.data ?? [])].sort((a, b) => (b.lessonDate ?? "").localeCompare(a.lessonDate ?? "")),
    [q.data],
  );

  const [creating, setCreating] = useState(false);

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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Cahier de textes</h1>
          <p className="text-sm text-slate-500">Séances, contenu des cours et devoirs donnés — suivi de progression</p>
        </div>
        {canWrite && effectiveClassId && <Button onClick={() => setCreating(true)} leftSection={<Plus className="h-4 w-4" />}>Nouvelle séance</Button>}
      </Reveal>

      <div className="flex flex-wrap items-end gap-3">
        <Select className="max-w-[240px]" label="Classe"
          data={classes.map((c) => ({ value: String(c.id), label: c.label }))}
          value={effectiveClassId != null ? String(effectiveClassId) : null}
          onChange={(value) => { setClassId(value ? Number(value) : null); setSubjectId(null); }} />
        <Select className="max-w-[240px]" label="Matière" clearable placeholder="Toutes"
          data={(subjectsQuery.data ?? []).map((s) => ({ value: String(s.id), label: s.label }))}
          value={subjectId != null ? String(subjectId) : null}
          onChange={(value) => setSubjectId(value ? Number(value) : null)} />
      </div>

      {effectiveClassId && lessons.length > 0 && (() => {
        const done = lessons.filter((l) => l.status === "DONE").length;
        const rate = Math.round((done / lessons.length) * 100);
        return (
          <div className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm ${rate >= 70 ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
            <span className="font-semibold">Taux de réalisation des cours : {rate}%</span>
            <span className="text-slate-500">{done}/{lessons.length} séances réalisées</span>
          </div>
        );
      })()}

      {q.loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : (
        <Table>
          <THead><tr><TH>Date</TH><TH>Matière</TH><TH>Thème</TH><TH>Devoirs</TH><TH>Statut</TH><TH className="text-right">Actions</TH></tr></THead>
          <TBody>
            {lessons.length === 0 && <TR><TD colSpan={6} className="py-10 text-center text-slate-400">Aucune séance.</TD></TR>}
            {lessons.map((l) => (
              <TR key={l.id}>
                <TD>{l.lessonDate}</TD>
                <TD>{subjectName.get(l.subjectId) ?? `#${l.subjectId}`}</TD>
                <TD className="max-w-[220px]">
                  <p className="font-medium text-slate-900">{l.title}</p>
                  {l.content && <p className="truncate text-xs text-slate-500" title={l.content}>{l.content}</p>}
                </TD>
                <TD className="max-w-[160px] truncate text-sm text-slate-600" title={l.homework ?? ""}>{l.homework ?? "—"}</TD>
                <TD><Badge tone={STATUS_TONE[l.status]}>{LESSON_STATUS_LABEL[l.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => act(l.status === "PLANNED" ? markLessonDone(l.id) : markLessonPlanned(l.id))}>{l.status === "PLANNED" ? "Réalisée" : "Replanifier"}</Button>}
                    {canWrite && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => remove(l)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle séance">
        {effectiveClassId && (
          <LessonForm classId={effectiveClassId} subjectName={subjectName} onCancel={() => setCreating(false)}
            onCreated={() => { setCreating(false); notifySuccess("Séance créée"); q.refetch(); }} />
        )}
      </Modal>
    </div>
  );
}

type LessonRow = { subjectId: string; title: string; content: string; homework: string; durationMinutes: number | string };
const EMPTY_LESSON_ROW: LessonRow = { subjectId: "", title: "", content: "", homework: "", durationMinutes: 60 };

function LessonForm({ classId, subjectName, onCancel, onCreated }: {
  classId: number; subjectName: Map<number, string>; onCancel: () => void; onCreated: () => void;
}) {
  const classSubjectsQuery = useQuery(() => listClassSubjects(classId), [classId]);
  const teachersQuery = useQuery(listTeachers, []);
  const classSubjects = useMemo(() => classSubjectsQuery.data ?? [], [classSubjectsQuery.data]);
  const teacherName = useMemo(
    () => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachersQuery.data]);

  const [loading, setLoading] = useState(false);
  const [lessonDate, setLessonDate] = useState<string>("");
  const [status, setStatus] = useState<"PLANNED" | "DONE">("DONE");
  const [rows, setRows] = useState<LessonRow[]>([EMPTY_LESSON_ROW]);

  const subjectData = [{ value: "", label: "— Choisir —" },
    ...classSubjects.map((cm) => ({ value: String(cm.subjectId), label: subjectName.get(cm.subjectId) ?? `#${cm.subjectId}` }))];

  function updateRow(idx: number, key: keyof LessonRow, value: string | number) {
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
    <Stack gap="md">
      <div className="grid grid-cols-2 gap-3">
        <DatePickerInput label="Date (commune)" valueFormat="DD/MM/YYYY" clearable
          value={lessonDate} onChange={(v) => setLessonDate(v ?? "")} />
        <Select label="Statut (commun)" allowDeselect={false}
          data={[{ value: "DONE", label: "Réalisée" }, { value: "PLANNED", label: "Planifiée" }]}
          value={status} onChange={(v) => setStatus((v ?? "DONE") as "PLANNED" | "DONE")} />
      </div>

      {rows.map((row, idx) => (
        <div key={idx} className="space-y-2 rounded-xl border border-slate-200 p-3">
          <div className="grid grid-cols-[1fr_100px_auto] items-end gap-2">
            <Select label="Matière" withAsterisk searchable data={subjectData}
              value={row.subjectId} onChange={(v) => updateRow(idx, "subjectId", v ?? "")} />
            <NumberInput label="Durée (min)" min={0}
              value={row.durationMinutes} onChange={(v) => updateRow(idx, "durationMinutes", v ?? "")} />
            <Button variant="ghost" className="text-red-600" disabled={rows.length === 1} onClick={() => removeRow(idx)}>✕</Button>
          </div>
          {row.subjectId && (
            <p className="text-xs text-slate-500">
              Enseignant : <span className={teacherFor(row.subjectId) ? "text-slate-700" : "text-amber-600"}>
                {teacherFor(row.subjectId) ?? "aucun enseignant affecté"}
              </span>
            </p>
          )}
          <TextInput label="Thème de la séance" withAsterisk
            value={row.title} onChange={(e) => updateRow(idx, "title", e.currentTarget.value)} />
          <Textarea label="Contenu" autosize minRows={2}
            value={row.content} onChange={(e) => updateRow(idx, "content", e.currentTarget.value)} />
          <Textarea label="Devoirs donnés" autosize minRows={1}
            value={row.homework} onChange={(e) => updateRow(idx, "homework", e.currentTarget.value)} />
        </div>
      ))}

      <Button variant="secondary" size="sm" onClick={addRow} style={{ alignSelf: "flex-start" }}>+ Ajouter une séance</Button>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={submit} loading={loading}>Créer {rows.length > 1 ? `(${rows.length})` : ""}</Button>
      </div>
    </Stack>
  );
}

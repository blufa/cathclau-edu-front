"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "@/providers/auth-provider";
import { hasRole } from "@/lib/auth/permissions";
import { useQuery } from "@/hooks/use-query";
import { getScheduleByClass, listAcademicYears, listClasses, listClassSubjects, listSubjects } from "@/lib/api/academics";
import { listTeachers } from "@/lib/api/staff";
import { getTeacherCheckins } from "@/lib/api/attendance";
import { createLesson, deleteLesson, listLessons, markLessonDone, markLessonPlanned, updateLesson } from "@/lib/api/lessons";
import { LESSON_STATUS_LABEL, type LessonEntry, type LessonStatus } from "@/lib/types/lesson";
import type { Classe, EmploiDuTemps, JourSemaine } from "@/lib/types/academics";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Modal } from "@/components/ui/modal";
import { Spinner } from "@/components/ui/spinner";
import { Field, Input, Label, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import { DatePicker } from "@/components/ui/date-picker";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Reveal } from "@/components/public/reveal";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { formatMinutes } from "@/lib/format";

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
  const [realizing, setRealizing] = useState<LessonEntry | null>(null);

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
                <TD>{l.subjectId != null ? (subjectName.get(l.subjectId) ?? `#${l.subjectId}`) : "Journée complète"}</TD>
                <TD className="max-w-[220px]">
                  <p className="font-medium text-gray-900">{l.title}</p>
                  {l.content && <p className="truncate text-xs text-gray-500" title={l.content}>{l.content}</p>}
                </TD>
                <TD className="max-w-[160px] truncate text-sm text-gray-600" title={l.homework ?? ""}>{l.homework ?? "—"}</TD>
                <TD><Badge tone={STATUS_TONE[l.status]}>{LESSON_STATUS_LABEL[l.status]}</Badge></TD>
                <TD className="text-right">
                  <div className="flex justify-end gap-1">
                    {canWrite && <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>Modifier</Button>}
                    {isAdmin && (l.status === "PLANNED"
                      ? <Button size="sm" variant="ghost" onClick={() => setRealizing(l)}>Réalisée</Button>
                      : <Button size="sm" variant="ghost" onClick={() => act(markLessonPlanned(l.id))}>Replanifier</Button>)}
                    {canWrite && <Button size="sm" variant="ghost" className="text-error-600" onClick={() => remove(l)}>Suppr.</Button>}
                  </div>
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle séance" className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {effectiveClassId && (
          <LessonForm classes={classes} defaultClassId={effectiveClassId} subjectName={subjectName} onCancel={() => setCreating(false)}
            onCreated={() => { setCreating(false); notifySuccess("Séance créée"); q.refetch(); }} />
        )}
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la séance">
        {editing && (
          <EditLessonForm lesson={editing} classes={classes} subjectName={subjectName} canSetStatus={isAdmin} onCancel={() => setEditing(null)}
            onSaved={() => { setEditing(null); notifySuccess("Séance mise à jour"); q.refetch(); }} />
        )}
      </Modal>

      <Modal open={!!realizing} onClose={() => setRealizing(null)} title="Confirmer la réalisation">
        {realizing && (
          <MarkDoneForm lesson={realizing} onCancel={() => setRealizing(null)}
            onDone={() => { setRealizing(null); notifySuccess("Séance réalisée"); q.refetch(); }} />
        )}
      </Modal>
    </div>
  );
}

type LessonRow = {
  classId: string; subjectId: string; title: string; content: string; homework: string; durationMinutes: string;
  /** Moniteur maternelle/primaire : un seul enseignant couvre toute la journée, pas de matière à choisir. */
  noSubject: boolean;
};
function emptyRow(defaultClassId: number | null): LessonRow {
  return {
    classId: defaultClassId != null ? String(defaultClassId) : "", subjectId: "", title: "", content: "", homework: "", durationMinutes: "",
    noSubject: false,
  };
}

const JS_DAY_TO_JOUR: Record<number, JourSemaine | undefined> = {
  1: "LUNDI", 2: "MARDI", 3: "MERCREDI", 4: "JEUDI", 5: "VENDREDI", 6: "SAMEDI",
};
function dayOfWeek(dateStr: string): JourSemaine | null {
  if (!dateStr) return null;
  return JS_DAY_TO_JOUR[new Date(`${dateStr}T00:00:00`).getDay()] ?? null;
}
function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}
/** Résout le créneau d'emploi du temps correspondant (classe+matière, au jour de la séance si connu). */
function resolveSlot(schedule: EmploiDuTemps[], subjectId: string, lessonDate: string): EmploiDuTemps | null {
  if (!subjectId) return null;
  const bySubject = schedule.filter((s) => String(s.subjectId) === subjectId);
  const day = dayOfWeek(lessonDate);
  const onDay = day ? bySubject.filter((s) => s.day === day) : [];
  return onDay[0] ?? bySubject[0] ?? null;
}
function todayIso(): string { return new Date().toISOString().slice(0, 10); }

/**
 * Affiche l'heure à laquelle l'enseignant a pointé (§attendance — cahier de textes) : utile au
 * directeur pédagogique qui programme la séance pour voir tout de suite si le professeur est déjà
 * arrivé, et avec quel retard. `slotId` cible un créneau précis (matière choisie) ; `"any"` retient
 * plutôt le premier pointage de la journée (moniteur maternelle/primaire, une seule séance couvrant
 * toute la journée, sans créneau de matière à faire correspondre). Rien ne s'affiche pour une date
 * future (le pointage n'a pas encore pu avoir lieu) ou tant que l'enseignant n'est pas connu.
 */
function TeacherCheckinCard({ teacherId, date, slotId }: { teacherId: number | null; date: string; slotId: number | null | "any" }) {
  const canLookup = teacherId != null && slotId != null && !!date && date <= todayIso();
  const q = useQuery(
    () => (canLookup ? getTeacherCheckins(teacherId!, date) : Promise.resolve([])),
    [canLookup, teacherId, date],
  );
  if (!canLookup) return null;
  if (q.loading) return null;
  const checkins = q.data ?? [];
  const checkin = slotId === "any"
    ? [...checkins].sort((a, b) => a.checkInTime.localeCompare(b.checkInTime))[0]
    : checkins.find((c) => c.scheduleSlotId === slotId);
  if (!checkin) {
    return <p className="text-xs text-gray-400">Pointage : pas encore pointé{slotId !== "any" ? " pour ce créneau" : ""}.</p>;
  }
  return (
    <p className="text-xs">
      Pointage : <span className="font-medium text-gray-700">{checkin.checkInTime.slice(0, 5)}</span>
      {checkin.lateMinutes > 0 && <span className="ml-1 text-warning-600">(retard {formatMinutes(checkin.lateMinutes)})</span>}
    </p>
  );
}

/**
 * Une classe choisie par ligne permet de programmer en une fois plusieurs séances d'un même
 * enseignant sur des classes différentes le même jour (ex. 8h-10h en 8ème, 10h-12h en 10ème).
 * Matière et classe choisies résolvent automatiquement l'enseignant et pré-remplissent la durée
 * depuis l'emploi du temps de la classe (reste éditable manuellement).
 */
function LessonForm({ classes, defaultClassId, subjectName, onCancel, onCreated }: {
  classes: Classe[]; defaultClassId: number | null; subjectName: Map<number, string>; onCancel: () => void; onCreated: () => void;
}) {
  const teachersQuery = useQuery(listTeachers, []);
  const teacherName = useMemo(
    () => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachersQuery.data]);

  const [loading, setLoading] = useState(false);
  const [lessonDate, setLessonDate] = useState("");
  const [rows, setRows] = useState<LessonRow[]>([emptyRow(defaultClassId)]);

  const classOptions: SearchableOption[] = useMemo(
    () => classes.map((c) => ({ value: String(c.id), trigger: c.label, label: c.label, searchText: c.label })),
    [classes],
  );

  // Affectations matière→enseignant + emploi du temps de chaque classe utilisée par une ligne,
  // chargés à la demande (une école peut avoir des dizaines de classes, inutile de tout charger).
  const rowClassIds = useMemo(() => Array.from(new Set(rows.map((r) => r.classId).filter(Boolean))), [rows]);
  const classDataQuery = useQuery(async () => {
    const entries = await Promise.all(rowClassIds.map(async (cidStr) => {
      const cid = Number(cidStr);
      const [subjects, schedule] = await Promise.all([listClassSubjects(cid), getScheduleByClass(cid)]);
      return [cid, { subjects, schedule }] as const;
    }));
    return new Map(entries);
  }, [rowClassIds.join(",")]);

  function subjectOptionsFor(classIdStr: string): SearchableOption[] {
    const subjects = classDataQuery.data?.get(Number(classIdStr))?.subjects ?? [];
    return subjects.map((cm) => {
      const label = subjectName.get(cm.subjectId) ?? `#${cm.subjectId}`;
      return { value: String(cm.subjectId), trigger: label, label, searchText: label };
    });
  }
  function teacherFor(classIdStr: string, sid: string): string | null {
    const subjects = classDataQuery.data?.get(Number(classIdStr))?.subjects ?? [];
    const cm = subjects.find((c) => String(c.subjectId) === sid);
    return cm?.teacherId ? (teacherName.get(cm.teacherId) ?? `#${cm.teacherId}`) : null;
  }
  function teacherIdFor(classIdStr: string, sid: string): number | null {
    const subjects = classDataQuery.data?.get(Number(classIdStr))?.subjects ?? [];
    return subjects.find((c) => String(c.subjectId) === sid)?.teacherId ?? null;
  }
  function slotFor(classIdStr: string, sid: string): EmploiDuTemps | null {
    const schedule = classDataQuery.data?.get(Number(classIdStr))?.schedule ?? [];
    return resolveSlot(schedule, sid, lessonDate);
  }
  /** Professeur principal de la classe — résout l'enseignant d'une séance « journée complète » (moniteur
   * maternelle/primaire, un seul enseignant, pas de matière à choisir). */
  function headTeacherIdFor(classIdStr: string): number | null {
    return classes.find((c) => String(c.id) === classIdStr)?.headTeacherId ?? null;
  }
  function headTeacherNameFor(classIdStr: string): string | null {
    const id = headTeacherIdFor(classIdStr);
    return id != null ? (teacherName.get(id) ?? `#${id}`) : null;
  }
  /** Durée totale des créneaux de la classe ce jour-là (tous, toutes matières confondues) — l'enseignant
   * unique couvre la journée jusqu'à l'heure de sortie, pas un seul créneau de matière. */
  function totalDayMinutesFor(classIdStr: string): number {
    const schedule = classDataQuery.data?.get(Number(classIdStr))?.schedule ?? [];
    const day = dayOfWeek(lessonDate);
    if (!day) return 0;
    return schedule.filter((s) => s.day === day)
      .reduce((sum, s) => sum + Math.max(0, timeToMinutes(s.endTime) - timeToMinutes(s.startTime)), 0);
  }

  function updateRow(idx: number, key: keyof LessonRow, value: string) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, [key]: value };
      if (key === "classId") next.subjectId = "";
      if (next.noSubject) {
        if (key === "classId") next.durationMinutes = String(totalDayMinutesFor(next.classId));
      } else if (key === "classId" || key === "subjectId") {
        const schedule = classDataQuery.data?.get(Number(next.classId))?.schedule ?? [];
        const slot = resolveSlot(schedule, next.subjectId, lessonDate);
        if (slot) next.durationMinutes = String(Math.max(0, timeToMinutes(slot.endTime) - timeToMinutes(slot.startTime)));
      }
      return next;
    }));
  }
  function toggleNoSubject(idx: number) {
    setRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const noSubject = !r.noSubject;
      return {
        ...r, noSubject, subjectId: "",
        durationMinutes: noSubject ? String(totalDayMinutesFor(r.classId)) : "",
      };
    }));
  }
  function addRow() { setRows((prev) => [...prev, emptyRow(defaultClassId)]); }
  function removeRow(idx: number) { setRows((prev) => prev.filter((_, i) => i !== idx)); }

  async function submit() {
    const valid = rows.filter((r) => r.classId && r.title.trim() && (r.noSubject || r.subjectId));
    if (valid.length === 0) { notifyError(null, "Ajoutez au moins une séance (classe + matière + thème)."); return; }
    const withoutTeacher = valid.find((r) => r.noSubject ? !headTeacherIdFor(r.classId) : !teacherFor(r.classId, r.subjectId));
    if (withoutTeacher) {
      notifyError(null, withoutTeacher.noSubject
        ? "Aucun professeur principal n'est désigné pour cette classe. Renseignez-le (fiche classe) avant de programmer la séance."
        : `Aucun enseignant n'est affecté à « ${subjectName.get(Number(withoutTeacher.subjectId)) ?? "cette matière"} » pour cette classe. `
          + "Affectez un enseignant (Référentiels → Classes → Matières) avant de programmer la séance.",
      );
      return;
    }
    setLoading(true);
    try {
      for (const r of valid) {
        await createLesson({
          classId: Number(r.classId),
          subjectId: r.noSubject ? null : Number(r.subjectId),
          lessonDate: lessonDate || null,
          title: r.title,
          content: r.content || null,
          homework: r.homework || null,
          durationMinutes: r.durationMinutes === "" ? null : Number(r.durationMinutes),
          status: "PLANNED",
        });
      }
      onCreated();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <Field><Label>Date (commune)</Label><DatePicker value={lessonDate} clearable onChange={setLessonDate} /></Field>

      {rows.map((row, idx) => (
        <div key={idx} className="space-y-2 rounded-xl border border-gray-200 p-3">
          <div className="grid grid-cols-[1fr_1fr_100px_auto] items-end gap-2">
            <Field>
              <Label>Classe <span className="text-error-500">*</span></Label>
              <SearchableSelect value={row.classId} options={classOptions} onChange={(v) => updateRow(idx, "classId", v)} triggerClassName="w-full justify-between px-3" />
            </Field>
            {!row.noSubject && (
              <Field>
                <Label>Matière <span className="text-error-500">*</span></Label>
                <SearchableSelect value={row.subjectId} options={subjectOptionsFor(row.classId)} onChange={(v) => updateRow(idx, "subjectId", v)} triggerClassName="w-full justify-between px-3" />
              </Field>
            )}
            <Field>
              <Label>Durée (min)</Label>
              <Input type="number" min={0} value={row.durationMinutes} onChange={(e) => updateRow(idx, "durationMinutes", e.target.value)} />
            </Field>
            <Button variant="ghost" className="text-error-600" disabled={rows.length === 1} onClick={() => removeRow(idx)}>✕</Button>
          </div>
          {row.classId && headTeacherIdFor(row.classId) != null && (
            <Checkbox
              label="Journée complète (moniteur maternelle/primaire — un seul enseignant, pas de matière à choisir)"
              checked={row.noSubject}
              onChange={() => toggleNoSubject(idx)}
            />
          )}
          {row.noSubject ? (
            <>
              <p className="text-xs text-gray-500">
                Enseignant (professeur principal) : <span className={headTeacherNameFor(row.classId) ? "text-gray-700" : "text-warning-600"}>
                  {headTeacherNameFor(row.classId) ?? "aucun professeur principal désigné"}
                </span>
              </p>
              <TeacherCheckinCard
                teacherId={headTeacherIdFor(row.classId)}
                date={lessonDate || todayIso()}
                slotId="any"
              />
            </>
          ) : row.subjectId && (
            <>
              <p className="text-xs text-gray-500">
                Enseignant : <span className={teacherFor(row.classId, row.subjectId) ? "text-gray-700" : "text-warning-600"}>
                  {teacherFor(row.classId, row.subjectId) ?? "aucun enseignant affecté"}
                </span>
              </p>
              <TeacherCheckinCard
                teacherId={teacherIdFor(row.classId, row.subjectId)}
                date={lessonDate || todayIso()}
                slotId={slotFor(row.classId, row.subjectId)?.id ?? null}
              />
            </>
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
function EditLessonForm({ lesson, classes, subjectName, canSetStatus, onCancel, onSaved }: {
  lesson: LessonEntry; classes: Classe[]; subjectName: Map<number, string>; canSetStatus: boolean; onCancel: () => void; onSaved: () => void;
}) {
  const classSubjectsQuery = useQuery(() => listClassSubjects(lesson.classId), [lesson.classId]);
  const teachersQuery = useQuery(listTeachers, []);
  const classSubjects = useMemo(() => classSubjectsQuery.data ?? [], [classSubjectsQuery.data]);
  const teacherName = useMemo(
    () => new Map((teachersQuery.data ?? []).map((t) => [t.id, `${t.firstName} ${t.lastName}`])),
    [teachersQuery.data]);
  const subjectOptions: SearchableOption[] = useMemo(
    () => classSubjects.map((cm) => {
      const label = subjectName.get(cm.subjectId) ?? `#${cm.subjectId}`;
      return { value: String(cm.subjectId), trigger: label, label, searchText: label };
    }),
    [classSubjects, subjectName],
  );
  function teacherFor(sid: string): string | null {
    const cm = classSubjects.find((c) => String(c.subjectId) === sid);
    return cm?.teacherId ? (teacherName.get(cm.teacherId) ?? `#${cm.teacherId}`) : null;
  }
  // Moniteur maternelle/primaire : professeur principal de la classe, pour une séance sans matière.
  const headTeacherId = classes.find((c) => c.id === lesson.classId)?.headTeacherId ?? null;
  const headTeacherName = headTeacherId != null ? (teacherName.get(headTeacherId) ?? `#${headTeacherId}`) : null;

  const [loading, setLoading] = useState(false);
  const [noSubject, setNoSubject] = useState(lesson.subjectId == null);
  const [subjectId, setSubjectId] = useState(lesson.subjectId != null ? String(lesson.subjectId) : "");
  const [lessonDate, setLessonDate] = useState(lesson.lessonDate ?? "");
  const [title, setTitle] = useState(lesson.title);
  const [content, setContent] = useState(lesson.content ?? "");
  const [homework, setHomework] = useState(lesson.homework ?? "");
  const [durationMinutes, setDurationMinutes] = useState(lesson.durationMinutes != null ? String(lesson.durationMinutes) : "");
  const [status, setStatus] = useState<LessonStatus>(lesson.status);

  async function submit() {
    if (!title.trim() || (!noSubject && !subjectId)) { notifyError(null, "Matière et thème requis."); return; }
    if (noSubject ? !headTeacherId : !teacherFor(subjectId)) {
      notifyError(null, noSubject
        ? "Aucun professeur principal n'est désigné pour cette classe."
        : `Aucun enseignant n'est affecté à « ${subjectName.get(Number(subjectId)) ?? "cette matière"} » pour cette classe. `
          + "Affectez un enseignant (Référentiels → Classes → Matières) avant d'enregistrer.",
      );
      return;
    }
    setLoading(true);
    try {
      await updateLesson(lesson.id, {
        classId: lesson.classId,
        subjectId: noSubject ? null : Number(subjectId),
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
        {!noSubject && (
          <Field>
            <Label>Matière <span className="text-error-500">*</span></Label>
            <SearchableSelect value={subjectId} options={subjectOptions} onChange={setSubjectId} triggerClassName="w-full justify-between px-3" />
          </Field>
        )}
        <Field><Label>Date</Label><DatePicker value={lessonDate} clearable onChange={setLessonDate} /></Field>
      </div>
      {headTeacherId != null && (
        <Checkbox
          label="Journée complète (moniteur maternelle/primaire — un seul enseignant, pas de matière à choisir)"
          checked={noSubject}
          onChange={() => { setNoSubject((v) => !v); setSubjectId(""); }}
        />
      )}
      {noSubject ? (
        <p className="text-xs text-gray-500">
          Enseignant (professeur principal) : <span className={headTeacherName ? "text-gray-700" : "text-warning-600"}>
            {headTeacherName ?? "aucun professeur principal désigné"}
          </span>
        </p>
      ) : subjectId && (
        <p className="text-xs text-gray-500">
          Enseignant : <span className={teacherFor(subjectId) ? "text-gray-700" : "text-warning-600"}>
            {teacherFor(subjectId) ?? "aucun enseignant affecté"}
          </span>
        </p>
      )}
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

/**
 * Confirmation avant de marquer une séance réalisée : la durée planifiée est proposée par défaut,
 * mais éditable — un professeur en retard peut avoir rattrapé (ou perdu) du temps. C'est cette durée
 * réalisée, jamais la durée planifiée, qui alimente ensuite la masse salariale (§payroll).
 */
function MarkDoneForm({ lesson, onCancel, onDone }: { lesson: LessonEntry; onCancel: () => void; onDone: () => void }) {
  const [duration, setDuration] = useState(lesson.durationMinutes != null ? String(lesson.durationMinutes) : "");
  const [loading, setLoading] = useState(false);

  // Option : compter depuis l'heure de pointage jusqu'à la fin prévue du créneau, plutôt que de saisir
  // la durée à la main — utile quand le professeur est arrivé en retard (ou en avance) et qu'on veut
  // exactement le temps réellement disponible pour le cours.
  const scheduleQuery = useQuery(() => getScheduleByClass(lesson.classId), [lesson.classId]);
  const slot = resolveSlot(scheduleQuery.data ?? [], String(lesson.subjectId), lesson.lessonDate ?? "");
  const checkinsQuery = useQuery(
    () => (lesson.teacherId != null && lesson.lessonDate && lesson.lessonDate <= todayIso()
      ? getTeacherCheckins(lesson.teacherId, lesson.lessonDate) : Promise.resolve([])),
    [lesson.teacherId, lesson.lessonDate],
  );
  const checkin = (checkinsQuery.data ?? []).find((c) => c.scheduleSlotId === slot?.id);
  // Priorité à l'heure de sortie réellement pointée (plus précise) ; à défaut, on suppose que
  // l'enseignant est resté jusqu'à la fin prévue du créneau.
  const endReference = checkin?.checkOutTime ?? slot?.endTime;
  const computedFromCheckin = checkin && endReference
    ? Math.max(0, timeToMinutes(endReference.slice(0, 5)) - timeToMinutes(checkin.checkInTime.slice(0, 5)))
    : null;

  async function confirm() {
    setLoading(true);
    try {
      await markLessonDone(lesson.id, duration === "" ? null : Number(duration));
      onDone();
    } catch (err) { notifyError(err); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Durée planifiée : <strong>{lesson.durationMinutes != null ? formatMinutes(lesson.durationMinutes) : "non renseignée"}</strong>.
        Corrigez si nécessaire (rattrapage ou retard) — c&apos;est la durée réalisée qui compte pour la paie de l&apos;enseignant.
      </p>
      {checkin && computedFromCheckin != null && (
        <div className="flex items-center justify-between rounded-lg bg-brand-50/60 px-3 py-2 text-xs">
          <span className="text-gray-600">
            Pointage à <strong>{checkin.checkInTime.slice(0, 5)}</strong>
            {checkin.lateMinutes > 0 && <span className="text-warning-600"> (retard {formatMinutes(checkin.lateMinutes)})</span>}
            {" "}→ {checkin.checkOutTime ? "sortie" : "fin prévue"} {endReference?.slice(0, 5)} = <strong>{formatMinutes(computedFromCheckin)}</strong>
          </span>
          <Button type="button" size="sm" variant="secondary" onClick={() => setDuration(String(computedFromCheckin))}>
            Utiliser cette durée
          </Button>
        </div>
      )}
      <Field>
        <Label>Durée réalisée (min)</Label>
        <Input type="number" min={0} value={duration} onChange={(e) => setDuration(e.target.value)} />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>Annuler</Button>
        <Button onClick={confirm} loading={loading}>Confirmer la réalisation</Button>
      </div>
    </div>
  );
}

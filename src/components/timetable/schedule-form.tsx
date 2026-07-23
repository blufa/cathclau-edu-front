"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { getAssignedClasses, getTeacherAvailability, getTeachersBySubject, type TeacherAvailability } from "@/lib/api/staff";
import { Button } from "@/components/ui/button";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { SearchableSelect, type SearchableOption } from "@/components/ui/searchable-select";
import type {
  ClasseMatiere,
  CreateScheduleInput,
  EmploiDuTemps,
  JourSemaine,
  Matiere,
  Salle,
} from "@/lib/types/academics";
import type { Teacher } from "@/lib/types/staff";

const DAYS: { value: JourSemaine; label: string }[] = [
  { value: "LUNDI", label: "Lundi" },
  { value: "MARDI", label: "Mardi" },
  { value: "MERCREDI", label: "Mercredi" },
  { value: "JEUDI", label: "Jeudi" },
  { value: "VENDREDI", label: "Vendredi" },
  { value: "SAMEDI", label: "Samedi" },
];

interface ScheduleFormProps {
  classId: number;
  initial?: EmploiDuTemps;
  subjects: Matiere[];
  teachers: Teacher[];
  rooms: Salle[];
  /** Matières affectées à la classe (avec l'enseignant) — restreint la matière et auto-affecte le prof. */
  classSubjects?: ClasseMatiere[];
  /** Libellés de classes (id → libellé) pour afficher les classes des enseignants proposés. */
  classLabelById?: Map<number, string>;
  onSubmit: (input: CreateScheduleInput) => Promise<void>;
  onCancel: () => void;
}

const scheduleSchema = z.object({
  subjectId: z.string(),
  teacherId: z.string(),
  roomId: z.string(),
  day: z.string(),
  startTime: z.string(),
  endTime: z.string(),
}).superRefine((v, ctx) => {
  if (!v.subjectId) ctx.addIssue({ code: "custom", path: ["subjectId"], message: "Matière requise" });
  if (!v.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Heure de début requise" });
  if (!v.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Heure de fin requise" });
  else if (v.endTime <= v.startTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "La fin doit être après le début" });
});
type ScheduleFormValues = z.infer<typeof scheduleSchema>;

export function ScheduleForm({ classId, initial, subjects, teachers, rooms, classSubjects, classLabelById, onSubmit, onCancel }: ScheduleFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { handleSubmit, watch, setValue, setError: setFieldError, formState: { errors } } = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleSchema),
    defaultValues: {
      subjectId: initial?.subjectId ? String(initial.subjectId) : "",
      teacherId: initial?.teacherId ? String(initial.teacherId) : "",
      roomId: initial?.roomId ? String(initial.roomId) : "",
      day: (initial?.day as JourSemaine) ?? "LUNDI",
      startTime: initial?.startTime?.slice(0, 5) ?? "",
      endTime: initial?.endTime?.slice(0, 5) ?? "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  // Disponibilités de l'enseignant sélectionné (affichées pour aider à choisir le créneau).
  const [availability, setAvailability] = useState<TeacherAvailability[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!v.teacherId) { if (active) setAvailability([]); return; }
      try {
        const a = await getTeacherAvailability(Number(v.teacherId));
        if (active) setAvailability(a);
      } catch {
        if (active) setAvailability([]);
      }
    })();
    return () => { active = false; };
  }, [v.teacherId]);
  const dayWindows = availability.filter((a) => a.day === v.day);

  // Pré-remplit les heures depuis la 1re plage de disponibilité du jour (création de créneau).
  const isNew = !initial;
  useEffect(() => {
    if (!isNew) return;
    const w = availability.find((a) => a.day === v.day);
    if (w) {
      setValue("startTime", w.startTime.slice(0, 5));
      setValue("endTime", w.endTime.slice(0, 5));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, v.day, isNew]);

  // Enseignants affectés à la matière choisie (chargés au choix de la matière).
  const [subjectTeacherIds, setSubjectTeacherIds] = useState<number[]>([]);
  const assigned = classSubjects ?? [];
  const teacherBySubject = new Map(assigned.map((cm) => [String(cm.subjectId), cm.teacherId]));
  // Si la classe a des matières affectées, on s'y limite (chacune a son enseignant) ; sinon toutes.
  const subjectOptions: SearchableOption[] = (assigned.length > 0
    ? assigned.map((cm) => {
      const label = subjects.find((s) => s.id === cm.subjectId)?.label ?? `Matière #${cm.subjectId}`;
      return { value: String(cm.subjectId), trigger: label, label, searchText: label };
    })
    : subjects.map((s) => ({ value: String(s.id), trigger: s.label, label: s.label, searchText: s.label })));
  // Classes enseignées par chaque prof de la matière (teacher_classes) : sert au filtrage par classe
  // ET au libellé. Map teacherId → liste des class ids affectés.
  const [teacherClassIds, setTeacherClassIds] = useState<Map<number, number[]>>(new Map());
  useEffect(() => {
    let active = true;
    void (async () => {
      if (subjectTeacherIds.length === 0) { if (active) setTeacherClassIds(new Map()); return; }
      try {
        const entries = await Promise.all(subjectTeacherIds.map(async (tid) =>
          [tid, await getAssignedClasses(tid)] as const));
        if (active) setTeacherClassIds(new Map(entries));
      } catch { if (active) setTeacherClassIds(new Map()); }
    })();
    return () => { active = false; };
  }, [subjectTeacherIds]);

  // Enseignants proposés : ceux de la matière, puis (si l'info est chargée) ceux affectés à CETTE
  // classe. Repli sur les profs de la matière si aucun n'est explicitement rattaché à la classe.
  const subjectTeachers = subjectTeacherIds.length > 0
    ? teachers.filter((t) => subjectTeacherIds.includes(t.id))
    : teachers;
  const classTeachers = subjectTeachers.filter((t) => teacherClassIds.get(t.id)?.includes(classId));
  const teacherOptionsList = classTeachers.length > 0 ? classTeachers : subjectTeachers;
  const teacherOptionLabel = (t: { id: number; firstName: string; lastName: string }) => {
    const cls = (teacherClassIds.get(t.id) ?? []).map((id) => classLabelById?.get(id) ?? `#${id}`).join(", ");
    return cls ? `${t.firstName} ${t.lastName} — ${cls}` : `${t.firstName} ${t.lastName}`;
  };
  const teacherOptions: SearchableOption[] = [
    { value: "", trigger: "— Non assigné —", label: "— Non assigné —", searchText: "non assigné" },
    ...teacherOptionsList.map((t) => {
      const label = teacherOptionLabel(t);
      return { value: String(t.id), trigger: label, label, searchText: label };
    }),
  ];
  const teacherHint = classTeachers.length > 0
    ? "Enseignants de la matière rattachés à cette classe"
    : subjectTeacherIds.length > 0
      ? "Enseignants de cette matière"
      : assigned.length > 0 ? "Enseignant de la matière (modifiable)" : undefined;

  function onSubjectChange(sid: string) {
    setValue("subjectId", sid);
    // Charge les enseignants affectés à cette matière.
    if (sid) getTeachersBySubject(Number(sid)).then(setSubjectTeacherIds).catch(() => setSubjectTeacherIds([]));
    else setSubjectTeacherIds([]);
    // Auto-affecte l'enseignant qui donne cette matière dans la classe (si défini).
    const tid = teacherBySubject.get(sid);
    if (tid != null) setValue("teacherId", String(tid));
  }

  async function handleFormSubmit(values: ScheduleFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        schoolClassId: classId,
        subjectId: Number(values.subjectId),
        teacherId: values.teacherId ? Number(values.teacherId) : null,
        roomId: values.roomId ? Number(values.roomId) : null,
        day: values.day as JourSemaine,
        startTime: values.startTime,
        endTime: values.endTime,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          for (const [field, message] of Object.entries(fieldErrors)) setFieldError(field as keyof ScheduleFormValues, { message });
        } else {
          setError(err.userMessage);
        }
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {error && <div className="rounded-lg bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}
      <Field>
        <Label>Matière <span className="text-error-500">*</span></Label>
        <SearchableSelect value={v.subjectId} options={subjectOptions} onChange={onSubjectChange} triggerClassName="w-full justify-between px-3" />
        {errors.subjectId && <p className="text-xs text-error-600">{errors.subjectId.message}</p>}
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Enseignant</Label>
          <SearchableSelect value={v.teacherId} options={teacherOptions} onChange={(val) => setValue("teacherId", val)} triggerClassName="w-full justify-between px-3" />
          {teacherHint && <p className="text-xs text-gray-400">{teacherHint}</p>}
        </Field>
        <Field>
          <Label>Salle</Label>
          <Select value={v.roomId} onChange={(e) => setValue("roomId", e.target.value)}>
            <option value="">— Aucune —</option>
            {rooms.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Jour</Label>
        <Select value={v.day} onChange={(e) => setValue("day", e.target.value)}>
          {DAYS.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
        </Select>
      </Field>
      {v.teacherId && (
        <p className="text-xs text-gray-500">
          {dayWindows.length > 0
            ? <>Disponibilités ce jour : <strong>{dayWindows.map((w) => `${w.startTime.slice(0, 5)}–${w.endTime.slice(0, 5)}`).join(", ")}</strong></>
            : "Aucune disponibilité déclarée par l'enseignant ce jour (renseignez-les sur sa fiche)."}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field>
          <Label>Début <span className="text-error-500">*</span></Label>
          <Input type="time" value={v.startTime} onChange={(e) => setValue("startTime", e.target.value)} aria-invalid={!!errors.startTime} />
          {errors.startTime && <p className="text-xs text-error-600">{errors.startTime.message}</p>}
        </Field>
        <Field>
          <Label>Fin <span className="text-error-500">*</span></Label>
          <Input type="time" value={v.endTime} onChange={(e) => setValue("endTime", e.target.value)} aria-invalid={!!errors.endTime} />
          {errors.endTime && <p className="text-xs text-error-600">{errors.endTime.message}</p>}
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Enregistrer</Button>
      </div>
    </form>
  );
}

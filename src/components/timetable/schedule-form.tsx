"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Group, Select, Stack } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { ApiError } from "@/lib/api/errors";
import { getAssignedClasses, getTeacherAvailability, getTeachersBySubject, type TeacherAvailability } from "@/lib/api/staff";
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

export function ScheduleForm({ classId, initial, subjects, teachers, rooms, classSubjects, classLabelById, onSubmit, onCancel }: ScheduleFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      subjectId: initial?.subjectId ? String(initial.subjectId) : "",
      teacherId: initial?.teacherId ? String(initial.teacherId) : "",
      roomId: initial?.roomId ? String(initial.roomId) : "",
      day: (initial?.day as JourSemaine) ?? "LUNDI",
      startTime: initial?.startTime?.slice(0, 5) ?? "",
      endTime: initial?.endTime?.slice(0, 5) ?? "",
    },
    validate: {
      subjectId: (v) => (v ? null : "Matière requise"),
      startTime: (v) => (v ? null : "Heure de début requise"),
      endTime: (v, values) =>
        !v ? "Heure de fin requise" : v <= values.startTime ? "La fin doit être après le début" : null,
    },
  });

  // Disponibilités de l'enseignant sélectionné (affichées pour aider à choisir le créneau).
  const [teacherSel, setTeacherSel] = useState(initial?.teacherId ? String(initial.teacherId) : "");
  const [daySel, setDaySel] = useState<JourSemaine>((initial?.day as JourSemaine) ?? "LUNDI");
  const [availability, setAvailability] = useState<TeacherAvailability[]>([]);
  useEffect(() => {
    let active = true;
    void (async () => {
      if (!teacherSel) { if (active) setAvailability([]); return; }
      try {
        const a = await getTeacherAvailability(Number(teacherSel));
        if (active) setAvailability(a);
      } catch {
        if (active) setAvailability([]);
      }
    })();
    return () => { active = false; };
  }, [teacherSel]);
  const dayWindows = availability.filter((a) => a.day === daySel);

  // Pré-remplit les heures depuis la 1re plage de disponibilité du jour (création de créneau).
  const isNew = !initial;
  useEffect(() => {
    if (!isNew) return;
    const w = availability.find((a) => a.day === daySel);
    if (w) {
      form.setFieldValue("startTime", w.startTime.slice(0, 5));
      form.setFieldValue("endTime", w.endTime.slice(0, 5));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availability, daySel, isNew]);

  // Enseignants affectés à la matière choisie (chargés au choix de la matière).
  const [subjectTeacherIds, setSubjectTeacherIds] = useState<number[]>([]);
  const assigned = classSubjects ?? [];
  const teacherBySubject = new Map(assigned.map((cm) => [String(cm.subjectId), cm.teacherId]));
  // Si la classe a des matières affectées, on s'y limite (chacune a son enseignant) ; sinon toutes.
  const subjectOptions = assigned.length > 0
    ? assigned.map((cm) => ({ value: String(cm.subjectId), label: subjects.find((s) => s.id === cm.subjectId)?.label ?? `Matière #${cm.subjectId}` }))
    : subjects.map((s) => ({ value: String(s.id), label: s.label }));
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
  const teacherOptions = classTeachers.length > 0 ? classTeachers : subjectTeachers;
  const teacherOptionLabel = (t: { id: number; firstName: string; lastName: string }) => {
    const cls = (teacherClassIds.get(t.id) ?? []).map((id) => classLabelById?.get(id) ?? `#${id}`).join(", ");
    return cls ? `${t.firstName} ${t.lastName} — ${cls}` : `${t.firstName} ${t.lastName}`;
  };

  async function handleSubmit(values: typeof form.values) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        schoolClassId: classId,
        subjectId: Number(values.subjectId),
        teacherId: values.teacherId ? Number(values.teacherId) : null,
        roomId: values.roomId ? Number(values.roomId) : null,
        day: values.day,
        startTime: values.startTime,
        endTime: values.endTime,
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Enregistrement impossible.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <Select
          label="Matière"
          withAsterisk
          data={[{ value: "", label: "— Sélectionner —" }, ...subjectOptions]}
          {...form.getInputProps("subjectId")}
          key={form.key("subjectId")}
          onChange={(value) => {
            const sid = value ?? "";
            form.setFieldValue("subjectId", sid);
            // Charge les enseignants affectés à cette matière.
            if (sid) getTeachersBySubject(Number(sid)).then(setSubjectTeacherIds).catch(() => setSubjectTeacherIds([]));
            else setSubjectTeacherIds([]);
            // Auto-affecte l'enseignant qui donne cette matière dans la classe (si défini).
            const tid = teacherBySubject.get(sid);
            if (tid != null) { form.setFieldValue("teacherId", String(tid)); setTeacherSel(String(tid)); }
          }}
        />
        <Group grow>
          <Select
            label="Enseignant"
            description={classTeachers.length > 0 ? "Enseignants de la matière rattachés à cette classe" : subjectTeacherIds.length > 0 ? "Enseignants de cette matière" : assigned.length > 0 ? "Enseignant de la matière (modifiable)" : undefined}
            data={[{ value: "", label: "— Non assigné —" }, ...teacherOptions.map((t) => ({ value: String(t.id), label: teacherOptionLabel(t) }))]}
            {...form.getInputProps("teacherId")}
            key={form.key("teacherId")}
            onChange={(value) => { form.setFieldValue("teacherId", value ?? ""); setTeacherSel(value ?? ""); }}
          />
          <Select
            label="Salle"
            data={[{ value: "", label: "— Aucune —" }, ...rooms.map((r) => ({ value: String(r.id), label: r.label }))]}
            {...form.getInputProps("roomId")}
            key={form.key("roomId")}
          />
        </Group>
        <Select
          label="Jour"
          data={DAYS}
          {...form.getInputProps("day")}
          key={form.key("day")}
          onChange={(value) => { const d = (value ?? "LUNDI") as JourSemaine; form.setFieldValue("day", d); setDaySel(d); }}
        />
        {teacherSel && (
          <p className="text-xs text-slate-500">
            {dayWindows.length > 0
              ? <>Disponibilités ce jour : <strong>{dayWindows.map((w) => `${w.startTime.slice(0, 5)}–${w.endTime.slice(0, 5)}`).join(", ")}</strong></>
              : "Aucune disponibilité déclarée par l'enseignant ce jour (renseignez-les sur sa fiche)."}
          </p>
        )}
        <Group grow>
          <TimeInput label="Début" withAsterisk {...form.getInputProps("startTime")} key={form.key("startTime")} />
          <TimeInput label="Fin" withAsterisk {...form.getInputProps("endTime")} key={form.key("endTime")} />
        </Group>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            Enregistrer
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

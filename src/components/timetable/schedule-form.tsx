"use client";

import { useState } from "react";
import { Alert, Button, Group, NativeSelect, Stack } from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { ApiError } from "@/lib/api/errors";
import type {
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
  onSubmit: (input: CreateScheduleInput) => Promise<void>;
  onCancel: () => void;
}

export function ScheduleForm({ classId, initial, subjects, teachers, rooms, onSubmit, onCancel }: ScheduleFormProps) {
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
        <NativeSelect
          label="Matière"
          withAsterisk
          data={[{ value: "", label: "— Sélectionner —" }, ...subjects.map((s) => ({ value: String(s.id), label: s.label }))]}
          {...form.getInputProps("subjectId")}
          key={form.key("subjectId")}
        />
        <Group grow>
          <NativeSelect
            label="Enseignant"
            data={[{ value: "", label: "— Non assigné —" }, ...teachers.map((t) => ({ value: String(t.id), label: `${t.firstName} ${t.lastName}` }))]}
            {...form.getInputProps("teacherId")}
            key={form.key("teacherId")}
          />
          <NativeSelect
            label="Salle"
            data={[{ value: "", label: "— Aucune —" }, ...rooms.map((r) => ({ value: String(r.id), label: r.label }))]}
            {...form.getInputProps("roomId")}
            key={form.key("roomId")}
          />
        </Group>
        <NativeSelect label="Jour" data={DAYS} {...form.getInputProps("day")} key={form.key("day")} />
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

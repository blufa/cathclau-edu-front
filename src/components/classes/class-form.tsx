"use client";

import { useState } from "react";
import { Alert, Button, Group, NativeSelect, NumberInput, SimpleGrid, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { ApiError } from "@/lib/api/errors";
import type { Classe, CreateClassInput, Niveau, Salle } from "@/lib/types/academics";

interface ClassFormProps {
  initial?: Classe;
  academicYearId: number;
  levels: Niveau[];
  rooms: Salle[];
  submitLabel: string;
  onSubmit: (input: CreateClassInput) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  label: string;
  levelId: string;
  roomId: string;
  maxCapacity: number | string;
  headTeacherId: number | string;
}

export function ClassForm({
  initial,
  academicYearId,
  levels,
  rooms,
  submitLabel,
  onSubmit,
  onCancel,
}: ClassFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: {
      label: initial?.label ?? "",
      levelId: initial?.levelId ? String(initial.levelId) : "",
      roomId: initial?.roomId ? String(initial.roomId) : "",
      maxCapacity: initial?.maxCapacity ?? "",
      headTeacherId: initial?.headTeacherId ?? "",
    },
    validate: {
      label: (v) => (v.trim() ? null : "Libellé requis"),
    },
  });

  async function handleSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        label: values.label,
        academicYearId,
        levelId: values.levelId ? Number(values.levelId) : null,
        roomId: values.roomId ? Number(values.roomId) : null,
        maxCapacity: values.maxCapacity === "" ? null : Number(values.maxCapacity),
        headTeacherId: values.headTeacherId === "" ? null : Number(values.headTeacherId),
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) form.setErrors(fieldErrors);
        else setError(err.userMessage);
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  const levelData = [{ value: "", label: "—" }, ...levels.map((l) => ({ value: String(l.id), label: l.label }))];
  const roomData = [{ value: "", label: "—" }, ...rooms.map((r) => ({ value: String(r.id), label: r.label }))];

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}

        <TextInput label="Libellé" withAsterisk placeholder="6e A" {...form.getInputProps("label")} key={form.key("label")} />

        <SimpleGrid cols={2}>
          <NativeSelect label="Niveau" data={levelData} {...form.getInputProps("levelId")} key={form.key("levelId")} />
          <NativeSelect label="Salle" data={roomData} {...form.getInputProps("roomId")} key={form.key("roomId")} />
        </SimpleGrid>

        <SimpleGrid cols={2}>
          <NumberInput label="Capacité max" min={0} allowDecimal={false} {...form.getInputProps("maxCapacity")} key={form.key("maxCapacity")} />
          <NumberInput
            label="Prof. principal (ID)"
            min={0}
            allowDecimal={false}
            placeholder="Optionnel"
            {...form.getInputProps("headTeacherId")}
            key={form.key("headTeacherId")}
          />
        </SimpleGrid>

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onCancel} disabled={submitting}>
            Annuler
          </Button>
          <Button type="submit" loading={submitting}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}

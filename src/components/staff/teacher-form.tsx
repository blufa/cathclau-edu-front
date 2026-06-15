"use client";

import { useState } from "react";
import { Alert, Button, Group, SimpleGrid, Stack, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { ApiError } from "@/lib/api/errors";
import type { CreateTeacherInput, Teacher } from "@/lib/types/staff";

interface TeacherFormProps {
  initial?: Teacher;
  submitLabel: string;
  onSubmit: (input: CreateTeacherInput) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  staffNumber: string;
  specialization: string;
  phone: string;
  email: string;
  hireDate: string;
}

export function TeacherForm({ initial, submitLabel, onSubmit, onCancel }: TeacherFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: {
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      staffNumber: initial?.staffNumber ?? "",
      specialization: initial?.specialization ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      hireDate: initial?.hireDate ?? "",
    },
    validate: {
      firstName: (v) => (v.trim() ? null : "Prénom requis"),
      lastName: (v) => (v.trim() ? null : "Nom requis"),
      email: (v) => (!v || /^\S+@\S+$/.test(v) ? null : "Email invalide"),
    },
  });

  async function handleSubmit(values: FormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        firstName: values.firstName,
        lastName: values.lastName,
        staffNumber: values.staffNumber || null,
        specialization: values.specialization || null,
        phone: values.phone || null,
        email: values.email || null,
        hireDate: values.hireDate || null,
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

  return (
    <form onSubmit={form.onSubmit(handleSubmit)}>
      <Stack gap="md">
        {error && (
          <Alert color="red" variant="light">
            {error}
          </Alert>
        )}
        <SimpleGrid cols={2}>
          <TextInput label="Prénom" withAsterisk {...form.getInputProps("firstName")} key={form.key("firstName")} />
          <TextInput label="Nom" withAsterisk {...form.getInputProps("lastName")} key={form.key("lastName")} />
        </SimpleGrid>
        <SimpleGrid cols={2}>
          <TextInput
            label="Matricule"
            placeholder="Auto-généré si vide"
            {...form.getInputProps("staffNumber")}
            key={form.key("staffNumber")}
          />
          <TextInput label="Spécialité" {...form.getInputProps("specialization")} key={form.key("specialization")} />
        </SimpleGrid>
        <SimpleGrid cols={2}>
          <TextInput label="Téléphone" {...form.getInputProps("phone")} key={form.key("phone")} />
          <TextInput label="Email" type="email" {...form.getInputProps("email")} key={form.key("email")} />
        </SimpleGrid>
        <DateInput
          label="Date d'embauche"
          valueFormat="DD/MM/YYYY"
          clearable
          {...form.getInputProps("hireDate")}
          key={form.key("hireDate")}
        />
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

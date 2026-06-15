"use client";

import { useState } from "react";
import { Alert, Button, Group, NativeSelect, SimpleGrid, Stack, TextInput } from "@mantine/core";
import { DateInput } from "@mantine/dates";
import { useForm } from "@mantine/form";
import { ApiError } from "@/lib/api/errors";
import type { CreateStudentInput, Gender, Student } from "@/lib/types/student";

interface StudentFormProps {
  initial?: Student;
  submitLabel: string;
  onSubmit: (input: CreateStudentInput) => Promise<void>;
  onCancel: () => void;
}

interface FormValues {
  firstName: string;
  lastName: string;
  gender: Gender;
  studentNumber: string;
  birthDate: string;
  birthPlace: string;
  phone: string;
  email: string;
  address: string;
  nationality: string;
}

export function StudentForm({ initial, submitLabel, onSubmit, onCancel }: StudentFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    mode: "uncontrolled",
    initialValues: {
      firstName: initial?.firstName ?? "",
      lastName: initial?.lastName ?? "",
      gender: initial?.gender ?? "MALE",
      studentNumber: initial?.studentNumber ?? "",
      birthDate: initial?.birthDate ?? "",
      birthPlace: initial?.birthPlace ?? "",
      phone: initial?.phone ?? "",
      email: initial?.email ?? "",
      address: initial?.address ?? "",
      nationality: initial?.nationality ?? "",
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
        gender: values.gender,
        studentNumber: values.studentNumber || null,
        birthDate: values.birthDate || null,
        birthPlace: values.birthPlace || null,
        phone: values.phone || null,
        email: values.email || null,
        address: values.address || null,
        nationality: values.nationality || null,
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
          <NativeSelect
            label="Sexe"
            data={[
              { value: "MALE", label: "Masculin" },
              { value: "FEMALE", label: "Féminin" },
            ]}
            {...form.getInputProps("gender")}
            key={form.key("gender")}
          />
          <TextInput
            label="Matricule"
            placeholder="Auto-généré si vide"
            {...form.getInputProps("studentNumber")}
            key={form.key("studentNumber")}
          />
        </SimpleGrid>

        <SimpleGrid cols={2}>
          <DateInput
            label="Date de naissance"
            valueFormat="DD/MM/YYYY"
            clearable
            {...form.getInputProps("birthDate")}
            key={form.key("birthDate")}
          />
          <TextInput label="Lieu de naissance" {...form.getInputProps("birthPlace")} key={form.key("birthPlace")} />
        </SimpleGrid>

        <SimpleGrid cols={2}>
          <TextInput label="Téléphone" {...form.getInputProps("phone")} key={form.key("phone")} />
          <TextInput label="Email" type="email" {...form.getInputProps("email")} key={form.key("email")} />
        </SimpleGrid>

        <SimpleGrid cols={2}>
          <TextInput label="Nationalité" {...form.getInputProps("nationality")} key={form.key("nationality")} />
          <TextInput label="Adresse" {...form.getInputProps("address")} key={form.key("address")} />
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

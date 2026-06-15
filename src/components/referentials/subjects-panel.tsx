"use client";

import { useState } from "react";
import { Button, Group, NumberInput, Stack, Textarea, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@/hooks/use-query";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "@/lib/api/academics";
import type { Matiere } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

function SubjectForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Matiere;
  onSubmit: (label: string, coefficient: number, syllabus?: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      label: initial?.label ?? "",
      coefficient: initial?.coefficient ? Number(initial.coefficient) : (1 as number | string),
      syllabus: initial?.syllabus ?? "",
    },
    validate: {
      label: (v) => (v.trim() ? null : "Libellé requis"),
      coefficient: (v) => (v !== "" && Number(v) > 0 ? null : "Coefficient invalide"),
    },
  });

  async function submit(values: { label: string; coefficient: number | string; syllabus: string }) {
    setSubmitting(true);
    try {
      await onSubmit(values.label, Number(values.coefficient), values.syllabus || undefined);
    } catch (err) {
      if (err instanceof ApiError) form.setErrors(err.fieldErrors);
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk placeholder="Mathématiques" {...form.getInputProps("label")} key={form.key("label")} />
        <NumberInput
          label="Coefficient"
          withAsterisk
          min={0}
          step={0.5}
          decimalScale={2}
          {...form.getInputProps("coefficient")}
          key={form.key("coefficient")}
        />
        <Textarea label="Programme" autosize minRows={2} {...form.getInputProps("syllabus")} key={form.key("syllabus")} />
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

export function SubjectsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listSubjects, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Matiere | null>(null);
  const subjects = q.data ?? [];

  async function handleCreate(label: string, coefficient: number, syllabus?: string) {
    await createSubject(label, coefficient, syllabus);
    setCreating(false);
    notifySuccess("Matière créée");
    q.refetch();
  }
  async function handleUpdate(label: string, coefficient: number, syllabus?: string) {
    if (!editing) return;
    await updateSubject(editing.id, label, coefficient, syllabus);
    setEditing(null);
    notifySuccess("Matière mise à jour");
    q.refetch();
  }
  function handleDelete(subject: Matiere) {
    confirmAction({
      title: "Supprimer la matière",
      message: `Supprimer la matière ${subject.label} ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteSubject(subject.id);
          notifySuccess("Matière supprimée");
          q.refetch();
        } catch (err) {
          notifyError(err);
        }
      },
    });
  }

  return (
    <Stack gap="md">
      {canWrite && (
        <Group justify="flex-end">
          <Button onClick={() => setCreating(true)}>Nouvelle matière</Button>
        </Group>
      )}
      <Table>
        <THead>
          <tr>
            <TH>Libellé</TH>
            <TH>Coefficient</TH>
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {subjects.length === 0 && (
            <TR>
              <TD colSpan={3} className="py-8 text-center text-gray-400">
                Aucune matière.
              </TD>
            </TR>
          )}
          {subjects.map((m) => (
            <TR key={m.id}>
              <TD className="font-medium">{m.label}</TD>
              <TD>{m.coefficient}</TD>
              <TD className="text-right">
                {canWrite && (
                  <Group justify="flex-end" gap="xs">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(m)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(m)}>
                      Suppr.
                    </Button>
                  </Group>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle matière">
        {creating && <SubjectForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la matière">
        {editing && <SubjectForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>
    </Stack>
  );
}

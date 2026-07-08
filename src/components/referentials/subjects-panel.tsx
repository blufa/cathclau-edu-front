"use client";

import { useState } from "react";
import { Autocomplete, Button, Group, Stack, Textarea } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@/hooks/use-query";
import { createSubject, deleteSubject, listSubjects, updateSubject } from "@/lib/api/academics";
import type { Matiere } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { SUBJECT_CATALOG } from "@/lib/academics-subjects";
import { SubjectCatalogPicker } from "@/components/referentials/subject-catalog";

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
      syllabus: initial?.syllabus ?? "",
    },
    validate: {
      label: (v) => (v.trim() ? null : "Libellé requis"),
    },
  });

  async function submit(values: { label: string; syllabus: string }) {
    setSubmitting(true);
    try {
      // Le coefficient n'est plus saisi à la matière : il se définit à l'affectation en classe et à
      // l'évaluation. On conserve la valeur existante (ou 1 par défaut) pour ne rien casser côté API.
      const coefficient = initial?.coefficient ? Number(initial.coefficient) : 1;
      await onSubmit(values.label, coefficient, values.syllabus || undefined);
    } catch (err) {
      if (err instanceof ApiError) form.setErrors(err.fieldErrors);
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <Autocomplete
          label="Libellé"
          description="Choisissez une matière proposée ou saisissez la vôtre"
          withAsterisk
          placeholder="Mathématiques"
          data={SUBJECT_CATALOG}
          {...form.getInputProps("label")}
          key={form.key("label")}
        />
        <Textarea label="Programme" autosize minRows={2} {...form.getInputProps("syllabus")} key={form.key("syllabus")} />
        <p className="text-xs text-gray-400">
          Le coefficient se définit lors de l&apos;affectation de la matière à une classe, et par évaluation.
        </p>
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
  const [assisting, setAssisting] = useState(false);
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
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => setAssisting(true)}>
            Catalogue
          </Button>
          <Button onClick={() => setCreating(true)}>Nouvelle matière</Button>
        </Group>
      )}
      <Table>
        <THead>
          <tr>
            <TH>Libellé</TH>
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {subjects.length === 0 && (
            <TR>
              <TD colSpan={2} className="py-8 text-center text-gray-400">
                Aucune matière.
              </TD>
            </TR>
          )}
          {subjects.map((m) => (
            <TR key={m.id}>
              <TD className="font-medium">{m.label}</TD>
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

      <Modal open={assisting} onClose={() => setAssisting(false)} title="Catalogue des matières">
        {assisting && (
          <SubjectCatalogPicker
            existing={subjects}
            onDone={() => {
              setAssisting(false);
              q.refetch();
            }}
            onCancel={() => setAssisting(false)}
          />
        )}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle matière">
        {creating && <SubjectForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la matière">
        {editing && <SubjectForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>
    </Stack>
  );
}

"use client";

import { useState } from "react";
import { Button, Group, NumberInput, Stack, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@/hooks/use-query";
import { createLevel, deleteLevel, listLevels, updateLevel } from "@/lib/api/academics";
import type { Niveau } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { LevelCatalogPicker } from "@/components/referentials/level-catalog";

function LevelForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Niveau;
  onSubmit: (label: string, sortOrder: number) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { label: initial?.label ?? "", sortOrder: initial?.sortOrder ?? 0 },
    validate: { label: (v) => (v.trim() ? null : "Libellé requis") },
  });

  async function submit(values: { label: string; sortOrder: number }) {
    setSubmitting(true);
    try {
      await onSubmit(values.label, Number(values.sortOrder));
    } catch (err) {
      if (err instanceof ApiError) form.setErrors(err.fieldErrors);
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk placeholder="6ème" {...form.getInputProps("label")} key={form.key("label")} />
        <NumberInput label="Ordre" min={0} allowDecimal={false} {...form.getInputProps("sortOrder")} key={form.key("sortOrder")} />
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

export function LevelsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listLevels, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Niveau | null>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const levels = (q.data ?? []).slice().sort((a, b) => a.sortOrder - b.sortOrder);

  async function handleCreate(label: string, sortOrder: number) {
    await createLevel(label, sortOrder);
    setCreating(false);
    notifySuccess("Niveau créé");
    q.refetch();
  }
  async function handleUpdate(label: string, sortOrder: number) {
    if (!editing) return;
    await updateLevel(editing.id, label, sortOrder);
    setEditing(null);
    notifySuccess("Niveau mis à jour");
    q.refetch();
  }
  function handleDelete(level: Niveau) {
    confirmAction({
      title: "Supprimer le niveau",
      message: `Supprimer le niveau ${level.label} ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteLevel(level.id);
          notifySuccess("Niveau supprimé");
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
          <Button variant="default" onClick={() => setCatalogOpen(true)}>
            Catalogue
          </Button>
          <Button onClick={() => setCreating(true)}>Nouveau niveau</Button>
        </Group>
      )}
      <Table>
        <THead>
          <tr>
            <TH>Ordre</TH>
            <TH>Libellé</TH>
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {levels.length === 0 && (
            <TR>
              <TD colSpan={3} className="py-8 text-center text-gray-400">
                Aucun niveau.
              </TD>
            </TR>
          )}
          {levels.map((l) => (
            <TR key={l.id}>
              <TD>{l.sortOrder}</TD>
              <TD className="font-medium">{l.label}</TD>
              <TD className="text-right">
                {canWrite && (
                  <Group justify="flex-end" gap="xs">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(l)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(l)}>
                      Suppr.
                    </Button>
                  </Group>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouveau niveau">
        {creating && <LevelForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier le niveau">
        {editing && <LevelForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>

      <Modal open={catalogOpen} onClose={() => setCatalogOpen(false)} title="Catalogue des niveaux">
        {catalogOpen && (
          <LevelCatalogPicker
            existing={levels}
            onDone={() => {
              setCatalogOpen(false);
              q.refetch();
            }}
            onCancel={() => setCatalogOpen(false)}
          />
        )}
      </Modal>
    </Stack>
  );
}

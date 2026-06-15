"use client";

import { useState } from "react";
import { Button, Group, NativeSelect, NumberInput, Stack, Switch, TextInput } from "@mantine/core";
import { useForm } from "@mantine/form";
import { useQuery } from "@/hooks/use-query";
import {
  createRoom,
  deleteRoom,
  listRooms,
  setRoomAvailability,
  updateRoom,
} from "@/lib/api/academics";
import type { CreateRoomInput, Salle, TypeSalle } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";

const TYPE_OPTIONS: { value: TypeSalle; label: string }[] = [
  { value: "SALLE_COURS", label: "Salle de cours" },
  { value: "LABORATOIRE", label: "Laboratoire" },
  { value: "AMPHI", label: "Amphithéâtre" },
  { value: "SALLE_INFO", label: "Salle informatique" },
  { value: "AUTRE", label: "Autre" },
];
const TYPE_LABEL = Object.fromEntries(TYPE_OPTIONS.map((o) => [o.value, o.label]));

function RoomForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Salle;
  onSubmit: (input: CreateRoomInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      label: initial?.label ?? "",
      building: initial?.building ?? "",
      capacity: initial?.capacity ?? ("" as number | string),
      type: (initial?.type as TypeSalle) ?? "SALLE_COURS",
    },
    validate: { label: (v) => (v.trim() ? null : "Libellé requis") },
  });

  async function submit(values: { label: string; building: string; capacity: number | string; type: TypeSalle }) {
    setSubmitting(true);
    try {
      await onSubmit({
        label: values.label,
        building: values.building || null,
        capacity: values.capacity === "" ? null : Number(values.capacity),
        type: values.type,
      });
    } catch (err) {
      if (err instanceof ApiError) form.setErrors(err.fieldErrors);
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={form.onSubmit(submit)}>
      <Stack gap="md">
        <TextInput label="Libellé" withAsterisk {...form.getInputProps("label")} key={form.key("label")} />
        <Group grow>
          <TextInput label="Bâtiment" {...form.getInputProps("building")} key={form.key("building")} />
          <NumberInput label="Capacité" min={0} allowDecimal={false} {...form.getInputProps("capacity")} key={form.key("capacity")} />
        </Group>
        <NativeSelect label="Type" data={TYPE_OPTIONS} {...form.getInputProps("type")} key={form.key("type")} />
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

export function RoomsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listRooms, []);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Salle | null>(null);
  const rooms = q.data ?? [];

  async function handleCreate(input: CreateRoomInput) {
    await createRoom(input);
    setCreating(false);
    notifySuccess("Salle créée");
    q.refetch();
  }
  async function handleUpdate(input: CreateRoomInput) {
    if (!editing) return;
    await updateRoom(editing.id, input);
    setEditing(null);
    notifySuccess("Salle mise à jour");
    q.refetch();
  }
  async function toggleAvailability(room: Salle) {
    try {
      await setRoomAvailability(room.id, !room.available);
      q.refetch();
    } catch (err) {
      notifyError(err);
    }
  }
  function handleDelete(room: Salle) {
    confirmAction({
      title: "Supprimer la salle",
      message: `Supprimer la salle ${room.label} ?`,
      confirmLabel: "Supprimer",
      danger: true,
      onConfirm: async () => {
        try {
          await deleteRoom(room.id);
          notifySuccess("Salle supprimée");
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
          <Button onClick={() => setCreating(true)}>Nouvelle salle</Button>
        </Group>
      )}
      <Table>
        <THead>
          <tr>
            <TH>Libellé</TH>
            <TH>Bâtiment</TH>
            <TH>Capacité</TH>
            <TH>Type</TH>
            <TH>Disponible</TH>
            <TH className="text-right">Actions</TH>
          </tr>
        </THead>
        <TBody>
          {rooms.length === 0 && (
            <TR>
              <TD colSpan={6} className="py-8 text-center text-gray-400">
                Aucune salle.
              </TD>
            </TR>
          )}
          {rooms.map((r) => (
            <TR key={r.id}>
              <TD className="font-medium">{r.label}</TD>
              <TD>{r.building ?? "—"}</TD>
              <TD>{r.capacity ?? "—"}</TD>
              <TD>{TYPE_LABEL[r.type ?? "AUTRE"] ?? r.type ?? "—"}</TD>
              <TD>
                <Switch
                  checked={r.available}
                  onChange={() => toggleAvailability(r)}
                  disabled={!canWrite}
                  size="sm"
                />
              </TD>
              <TD className="text-right">
                {canWrite && (
                  <Group justify="flex-end" gap="xs">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(r)}>
                      Modifier
                    </Button>
                    <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleDelete(r)}>
                      Suppr.
                    </Button>
                  </Group>
                )}
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle salle">
        {creating && <RoomForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la salle">
        {editing && <RoomForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>
    </Stack>
  );
}

"use client";

import { useState } from "react";
import { Button, Group, Stack, Switch } from "@mantine/core";
import { useQuery } from "@/hooks/use-query";
import {
  createRoom,
  deleteRoom,
  listRooms,
  setRoomAvailability,
  updateRoom,
} from "@/lib/api/academics";
import type { CreateRoomInput, Salle } from "@/lib/types/academics";
import { Modal } from "@/components/ui/modal";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { confirmAction, notifyError, notifySuccess } from "@/lib/feedback";
import { RoomForm, ROOM_TYPE_LABEL } from "@/components/referentials/room-form";
import { RoomAssistant } from "@/components/referentials/room-assistant";

const TYPE_LABEL = ROOM_TYPE_LABEL;

export function RoomsPanel({ canWrite }: { canWrite: boolean }) {
  const q = useQuery(listRooms, []);
  const [creating, setCreating] = useState(false);
  const [assisting, setAssisting] = useState(false);
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
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={() => setAssisting(true)}>
            Assistant (en lot)
          </Button>
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

      <Modal open={assisting} onClose={() => setAssisting(false)} title="Assistant — création de salles">
        {assisting && (
          <RoomAssistant
            existingRooms={rooms}
            onCreated={() => {
              setAssisting(false);
              q.refetch();
            }}
            onCancel={() => setAssisting(false)}
          />
        )}
      </Modal>
      <Modal open={creating} onClose={() => setCreating(false)} title="Nouvelle salle">
        {creating && <RoomForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier la salle">
        {editing && <RoomForm initial={editing} onSubmit={handleUpdate} onCancel={() => setEditing(null)} />}
      </Modal>
    </Stack>
  );
}

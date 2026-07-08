"use client";

import { useMemo, useState } from "react";
import { Autocomplete, Button, Group, NumberInput, Select, Stack, Text } from "@mantine/core";
import { createRoom } from "@/lib/api/academics";
import type { Salle, TypeSalle } from "@/lib/types/academics";
import { notifyError, notifySuccess } from "@/lib/feedback";
import { BUILDINGS, FLOORS, roomSuggestions } from "@/lib/academics-rooms";
import { ROOM_TYPE_OPTIONS } from "@/components/referentials/room-form";

/**
 * Assistant : bâtiment + étage + nombre de salles → crée toutes les salles d'un coup
 * (« Salle 101 », « Salle 102 »…), avec capacité et type communs. Évite la saisie répétitive.
 */
export function RoomAssistant({
  existingRooms,
  onCreated,
  onCancel,
}: {
  existingRooms: Salle[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const [building, setBuilding] = useState("Bâtiment principal");
  const [floor, setFloor] = useState("1");
  const [count, setCount] = useState<number | string>(6);
  const [capacity, setCapacity] = useState<number | string>("");
  const [type, setType] = useState<TypeSalle>("SALLE_COURS");
  const [saving, setSaving] = useState(false);

  const planned = useMemo(
    () => (floor ? roomSuggestions(floor, Math.max(0, Number(count) || 0)) : []),
    [floor, count],
  );
  const existingLabels = new Set(existingRooms.map((r) => r.label.trim().toLowerCase()));
  const toCreate = planned.filter((label) => !existingLabels.has(label.toLowerCase()));
  const skipped = planned.length - toCreate.length;

  async function handleCreate() {
    if (toCreate.length === 0) return;
    setSaving(true);
    try {
      for (const label of toCreate) {
        await createRoom({
          label,
          building: building || null,
          capacity: capacity === "" ? null : Number(capacity),
          type,
        });
      }
      notifySuccess(`${toCreate.length} salle${toCreate.length > 1 ? "s créées" : " créée"}`);
      onCreated();
    } catch (err) {
      notifyError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">
        Choisissez l&apos;étage et le nombre de salles : l&apos;assistant crée toute la numérotation
        (ex. « Salle 101 », « Salle 102 »…).
      </Text>
      <Group grow>
        <Autocomplete label="Bâtiment" data={BUILDINGS} value={building} onChange={setBuilding} disabled={saving} />
        <Select label="Étage" data={FLOORS} value={floor} onChange={(v) => setFloor(v ?? "")} disabled={saving} />
      </Group>
      <Group grow>
        <NumberInput label="Nombre de salles" min={1} max={40} allowDecimal={false} value={count} onChange={setCount} disabled={saving} />
        <NumberInput label="Capacité (toutes)" min={0} allowDecimal={false} value={capacity} onChange={setCapacity} disabled={saving} />
        <Select label="Type" data={ROOM_TYPE_OPTIONS} value={type} onChange={(v) => setType((v as TypeSalle) ?? "SALLE_COURS")} disabled={saving} />
      </Group>

      {planned.length > 0 && (
        <Text size="sm">
          <strong>{toCreate.length}</strong> salle{toCreate.length > 1 ? "s" : ""} à créer
          {skipped > 0 && ` (${skipped} déjà existante${skipped > 1 ? "s" : ""} ignorée${skipped > 1 ? "s" : ""})`}
          {toCreate.length > 0 && ` : ${toCreate.slice(0, 8).join(", ")}${toCreate.length > 8 ? "…" : ""}`}
        </Text>
      )}

      <Group justify="flex-end" gap="sm">
        <Button variant="default" onClick={onCancel} disabled={saving}>
          Annuler
        </Button>
        <Button onClick={handleCreate} loading={saving} disabled={toCreate.length === 0}>
          Créer {toCreate.length > 0 ? `(${toCreate.length})` : ""}
        </Button>
      </Group>
    </Stack>
  );
}

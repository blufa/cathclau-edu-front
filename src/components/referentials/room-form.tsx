"use client";

import { useState } from "react";
import { Autocomplete, Button, Group, NumberInput, Select, Stack } from "@mantine/core";
import { useForm } from "@mantine/form";
import type { CreateRoomInput, Salle, TypeSalle } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { notifyError } from "@/lib/feedback";
import { BUILDINGS, FLOORS, roomSuggestions } from "@/lib/academics-rooms";

export const ROOM_TYPE_OPTIONS: { value: TypeSalle; label: string }[] = [
  { value: "SALLE_COURS", label: "Salle de cours" },
  { value: "LABORATOIRE", label: "Laboratoire" },
  { value: "AMPHI", label: "Amphithéâtre" },
  { value: "SALLE_INFO", label: "Salle informatique" },
  { value: "AUTRE", label: "Autre" },
];
export const ROOM_TYPE_LABEL = Object.fromEntries(ROOM_TYPE_OPTIONS.map((o) => [o.value, o.label]));

/** Formulaire de salle réutilisable (référentiels + création inline depuis une classe). */
export function RoomForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: Salle;
  onSubmit: (input: CreateRoomInput) => Promise<void>;
  onCancel: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  // Étage : aide à la numérotation des salles (ex. 1er étage → « Salle 101 »). Non stocké séparément.
  const [floor, setFloor] = useState<string>("");
  const form = useForm({
    mode: "controlled",
    initialValues: {
      label: initial?.label ?? "",
      // Défaut « Bâtiment principal » à la création (une école a le plus souvent un seul bâtiment).
      building: initial ? (initial.building ?? "") : "Bâtiment principal",
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
        <Group grow>
          <Autocomplete label="Bâtiment" data={BUILDINGS} {...form.getInputProps("building")} />
          <Select
            label="Étage"
            placeholder="Choisir"
            data={FLOORS}
            value={floor}
            onChange={(v) => setFloor(v ?? "")}
            clearable
          />
        </Group>
        <Autocomplete
          label="Libellé de la salle"
          description="Choisissez une salle proposée ou saisissez la vôtre"
          placeholder={floor ? "Salle proposée…" : "ex. Salle 101"}
          withAsterisk
          data={floor ? roomSuggestions(floor) : []}
          {...form.getInputProps("label")}
        />
        <Group grow>
          <NumberInput label="Capacité" min={0} allowDecimal={false} {...form.getInputProps("capacity")} />
          <Select label="Type" data={ROOM_TYPE_OPTIONS} {...form.getInputProps("type")} />
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

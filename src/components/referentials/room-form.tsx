"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label, Field } from "@/components/ui/input";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import type { CreateRoomInput, Salle, TypeSalle } from "@/lib/types/academics";
import { ApiError } from "@/lib/api/errors";
import { notifyError } from "@/lib/feedback";
import { BUILDINGS, roomSuggestions } from "@/lib/academics-rooms";

export const ROOM_TYPE_OPTIONS: { value: TypeSalle; label: string }[] = [
  { value: "SALLE_COURS", label: "Salle de cours" },
  { value: "LABORATOIRE", label: "Laboratoire" },
  { value: "AMPHI", label: "Amphithéâtre" },
  { value: "SALLE_INFO", label: "Salle informatique" },
  { value: "AUTRE", label: "Autre" },
];
export const ROOM_TYPE_LABEL = Object.fromEntries(ROOM_TYPE_OPTIONS.map((o) => [o.value, o.label]));

const roomSchema = z.object({
  label: z.string().trim().min(1, "Libellé requis"),
  building: z.string(),
  capacity: z.union([z.number(), z.literal("")]),
  type: z.string(),
});
type RoomFormValues = z.infer<typeof roomSchema>;

const ROOM_LABEL_SUGGESTIONS = roomSuggestions(1, 12);

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
  const { handleSubmit, watch, setValue, setError, formState: { errors } } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
    defaultValues: {
      label: initial?.label ?? "",
      // Défaut « Bâtiment principal » à la création (une école a le plus souvent un seul bâtiment).
      building: initial ? (initial.building ?? "") : "Bâtiment principal",
      capacity: initial?.capacity ?? "",
      type: (initial?.type as TypeSalle) ?? "SALLE_COURS",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function submit(values: RoomFormValues) {
    setSubmitting(true);
    try {
      await onSubmit({
        label: values.label,
        building: values.building || null,
        capacity: values.capacity === "" ? null : Number(values.capacity),
        type: values.type as TypeSalle,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        for (const [field, message] of Object.entries(err.fieldErrors)) setError(field as keyof RoomFormValues, { message });
      }
      notifyError(err);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      <Field>
        <Label>Bâtiment</Label>
        <Combobox value={v.building} onChange={(val) => setValue("building", val)} options={BUILDINGS} />
      </Field>
      <Field>
        <Label>Libellé de la salle <span className="text-error-500">*</span></Label>
        <p className="text-xs text-gray-400">Choisissez une salle proposée ou saisissez la vôtre</p>
        <Combobox value={v.label} onChange={(val) => setValue("label", val)} options={ROOM_LABEL_SUGGESTIONS} placeholder="ex. Salle 001" />
        {errors.label && <p className="text-xs text-error-600">{errors.label.message}</p>}
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Capacité</Label>
          <Input type="number" min={0} value={v.capacity} onChange={(e) => setValue("capacity", e.target.value === "" ? "" : Number(e.target.value))} />
        </Field>
        <Field>
          <Label>Type</Label>
          <Select value={v.type} onChange={(e) => setValue("type", e.target.value)}>
            {ROOM_TYPE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </Select>
        </Field>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>Annuler</Button>
        <Button type="submit" loading={submitting}>Enregistrer</Button>
      </div>
    </form>
  );
}

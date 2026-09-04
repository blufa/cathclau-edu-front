"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input, Label, Field } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { EffectiveScheduleSlot, JourSemaine, MoveScheduleForWeekInput, Salle } from "@/lib/types/academics";
import type { Teacher } from "@/lib/types/staff";

const DAYS: { value: JourSemaine; label: string }[] = [
  { value: "LUNDI", label: "Lundi" },
  { value: "MARDI", label: "Mardi" },
  { value: "MERCREDI", label: "Mercredi" },
  { value: "JEUDI", label: "Jeudi" },
  { value: "VENDREDI", label: "Vendredi" },
  { value: "SAMEDI", label: "Samedi" },
];

interface MoveScheduleForWeekFormProps {
  slot: EffectiveScheduleSlot;
  weekStartDate: string;
  rooms: Salle[];
  teachers: Teacher[];
  onSubmit: (input: MoveScheduleForWeekInput) => Promise<void>;
  onCancelException: () => Promise<void>;
  onCancel: () => void;
}

const moveSchema = z.object({
  day: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  roomId: z.string(),
  teacherId: z.string(),
  reason: z.string(),
}).superRefine((v, ctx) => {
  if (!v.startTime) ctx.addIssue({ code: "custom", path: ["startTime"], message: "Heure de début requise" });
  if (!v.endTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "Heure de fin requise" });
  else if (v.endTime <= v.startTime) ctx.addIssue({ code: "custom", path: ["endTime"], message: "La fin doit être après le début" });
});
type MoveFormValues = z.infer<typeof moveSchema>;

/** Déplace (ou annule) un créneau récurrent pour UNE semaine précise seulement — le modèle récurrent
 * n'est jamais modifié (voir `ScheduleException` côté back). */
export function MoveScheduleForWeekForm({ slot, weekStartDate, rooms, teachers, onSubmit, onCancelException, onCancel }: MoveScheduleForWeekFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const { handleSubmit, watch, setValue, setError: setFieldError, formState: { errors } } = useForm<MoveFormValues>({
    resolver: zodResolver(moveSchema),
    defaultValues: {
      day: slot.day,
      startTime: slot.startTime.slice(0, 5),
      endTime: slot.endTime.slice(0, 5),
      roomId: slot.roomId ? String(slot.roomId) : "",
      teacherId: slot.teacherId ? String(slot.teacherId) : "",
      reason: "",
    },
  });
  // eslint-disable-next-line react-hooks/incompatible-library -- react-hook-form manages its own memoization
  const v = watch();

  async function handleFormSubmit(values: MoveFormValues) {
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        weekStartDate,
        newDay: values.day as JourSemaine,
        newStartTime: values.startTime,
        newEndTime: values.endTime,
        newRoomId: values.roomId ? Number(values.roomId) : null,
        newTeacherId: values.teacherId ? Number(values.teacherId) : null,
        reason: values.reason || null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldErrors = err.fieldErrors;
        if (Object.keys(fieldErrors).length > 0) {
          for (const [field, message] of Object.entries(fieldErrors)) setFieldError(field as keyof MoveFormValues, { message });
        } else {
          setError(err.userMessage);
        }
      } else {
        setError("Déplacement impossible.");
      }
      setSubmitting(false);
    }
  }

  async function handleCancelException() {
    setError(null);
    setCancelling(true);
    try {
      await onCancelException();
    } catch (err) {
      setError(err instanceof ApiError ? err.userMessage : "Annulation impossible.");
      setCancelling(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <p className="text-xs text-gray-500">
        Ce changement ne s&apos;applique qu&apos;à la semaine du <strong>{weekStartDate}</strong> — les autres
        semaines gardent le créneau habituel.
      </p>
      {error && <div className="rounded-lg bg-error-50 px-3.5 py-2.5 text-sm text-error-700">{error}</div>}
      <Field>
        <Label>Jour</Label>
        <Select value={v.day} onChange={(e) => setValue("day", e.target.value)}>
          {DAYS.map((d) => (<option key={d.value} value={d.value}>{d.label}</option>))}
        </Select>
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Début <span className="text-error-500">*</span></Label>
          <Input type="time" value={v.startTime} onChange={(e) => setValue("startTime", e.target.value)} aria-invalid={!!errors.startTime} />
          {errors.startTime && <p className="text-xs text-error-600">{errors.startTime.message}</p>}
        </Field>
        <Field>
          <Label>Fin <span className="text-error-500">*</span></Label>
          <Input type="time" value={v.endTime} onChange={(e) => setValue("endTime", e.target.value)} aria-invalid={!!errors.endTime} />
          {errors.endTime && <p className="text-xs text-error-600">{errors.endTime.message}</p>}
        </Field>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field>
          <Label>Salle</Label>
          <Select value={v.roomId} onChange={(e) => setValue("roomId", e.target.value)}>
            <option value="">— Aucune —</option>
            {rooms.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
          </Select>
        </Field>
        <Field>
          <Label>Enseignant</Label>
          <Select value={v.teacherId} onChange={(e) => setValue("teacherId", e.target.value)}>
            <option value="">— Non assigné —</option>
            {teachers.map((t) => (<option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>))}
          </Select>
        </Field>
      </div>
      <Field>
        <Label>Motif (optionnel)</Label>
        <Input value={v.reason} onChange={(e) => setValue("reason", e.target.value)} placeholder="Ex. sortie scolaire, absence…" />
      </Field>
      <div className="flex items-center justify-between gap-2">
        {slot.moved ? (
          <Button type="button" variant="ghost" onClick={handleCancelException} loading={cancelling} disabled={submitting}>
            Annuler ce déplacement
          </Button>
        ) : <span />}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting || cancelling}>Fermer</Button>
          <Button type="submit" loading={submitting} disabled={cancelling}>Déplacer</Button>
        </div>
      </div>
    </form>
  );
}

"use client";

import { useState } from "react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Field, Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Classe, CreateClassInput, Niveau, Salle } from "@/lib/types/academics";

interface ClassFormProps {
  initial?: Classe;
  academicYearId: number;
  levels: Niveau[];
  rooms: Salle[];
  submitLabel: string;
  onSubmit: (input: CreateClassInput) => Promise<void>;
  onCancel: () => void;
}

export function ClassForm({
  initial,
  academicYearId,
  levels,
  rooms,
  submitLabel,
  onSubmit,
  onCancel,
}: ClassFormProps) {
  const [label, setLabel] = useState(initial?.label ?? "");
  const [levelId, setLevelId] = useState(initial?.levelId ? String(initial.levelId) : "");
  const [roomId, setRoomId] = useState(initial?.roomId ? String(initial.roomId) : "");
  const [headTeacherId, setHeadTeacherId] = useState(
    initial?.headTeacherId ? String(initial.headTeacherId) : "",
  );
  const [maxCapacity, setMaxCapacity] = useState(
    initial?.maxCapacity != null ? String(initial.maxCapacity) : "",
  );

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await onSubmit({
        label,
        academicYearId,
        levelId: levelId ? Number(levelId) : null,
        roomId: roomId ? Number(roomId) : null,
        headTeacherId: headTeacherId ? Number(headTeacherId) : null,
        maxCapacity: maxCapacity ? Number(maxCapacity) : null,
      });
    } catch (err) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        setError(Object.keys(err.fieldErrors).length === 0 ? err.userMessage : null);
      } else {
        setError("Enregistrement impossible.");
      }
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <Field>
        <Label htmlFor="label">Libellé *</Label>
        <Input id="label" required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="6e A" />
        {fieldErrors.label && <p className="text-xs text-red-600">{fieldErrors.label}</p>}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="levelId">Niveau</Label>
          <Select id="levelId" value={levelId} onChange={(e) => setLevelId(e.target.value)}>
            <option value="">—</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="roomId">Salle</Label>
          <Select id="roomId" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">—</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <Label htmlFor="maxCapacity">Capacité max</Label>
          <Input
            id="maxCapacity"
            type="number"
            min={0}
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
          />
        </Field>
        <Field>
          <Label htmlFor="headTeacherId">Prof. principal (ID)</Label>
          <Input
            id="headTeacherId"
            type="number"
            min={0}
            value={headTeacherId}
            onChange={(e) => setHeadTeacherId(e.target.value)}
            placeholder="Optionnel"
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={submitting}>
          Annuler
        </Button>
        <Button type="submit" loading={submitting}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
